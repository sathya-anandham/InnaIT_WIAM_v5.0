package io.innait.wiam.sessionservice.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.innait.wiam.common.context.TenantContext;
import io.innait.wiam.common.event.EventEnvelope;
import io.innait.wiam.common.exception.ResourceNotFoundException;
import io.innait.wiam.common.kafka.EventPublisher;
import io.innait.wiam.common.kafka.InnaITTopics;
import io.innait.wiam.common.redis.RedisCacheKeys;
import io.innait.wiam.sessionservice.dto.*;
import io.innait.wiam.sessionservice.entity.*;
import io.innait.wiam.sessionservice.repository.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.*;

@Service
public class SessionService {

    private final SessionRepository sessionRepository;
    private final SessionContextRepository sessionContextRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final SessionEventRepository sessionEventRepository;
    private final StringRedisTemplate redisTemplate;
    private final ObjectMapper objectMapper;
    private final EventPublisher eventPublisher;
    private final SecureRandom secureRandom = new SecureRandom();

    @Value("${wiam.session.ttl-seconds:28800}")
    private long sessionTtlSeconds; // 8 hours default

    @Value("${wiam.session.max-concurrent:5}")
    private int maxConcurrentSessions;

    @Value("${wiam.session.refresh-token-ttl-seconds:604800}")
    private long refreshTokenTtlSeconds; // 7 days default

    public SessionService(SessionRepository sessionRepository,
                          SessionContextRepository sessionContextRepository,
                          RefreshTokenRepository refreshTokenRepository,
                          SessionEventRepository sessionEventRepository,
                          StringRedisTemplate redisTemplate,
                          ObjectMapper objectMapper,
                          EventPublisher eventPublisher) {
        this.sessionRepository = sessionRepository;
        this.sessionContextRepository = sessionContextRepository;
        this.refreshTokenRepository = refreshTokenRepository;
        this.sessionEventRepository = sessionEventRepository;
        this.redisTemplate = redisTemplate;
        this.objectMapper = objectMapper;
        this.eventPublisher = eventPublisher;
    }

    @Transactional
    public UUID createSession(CreateSessionRequest request) {
        UUID tenantId = TenantContext.requireTenantId();

        // Enforce max concurrent sessions — revoke oldest if exceeded
        enforceMaxConcurrentSessions(request.accountId(), tenantId);

        // Create session entity
        Session session = new Session();
        session.setTenantId(tenantId);
        session.setAccountId(request.accountId());
        session.setSessionType(parseSessionType(request.sessionType()));
        session.setSessionStatus(SessionStatus.ACTIVE);
        session.setAuthTxnId(request.authTxnId());
        session.setAuthLevel(request.acrLevel());
        session.setExpiresAt(Instant.now().plusSeconds(sessionTtlSeconds));
        sessionRepository.save(session);

        // Create session context
        SessionContext context = new SessionContext();
        context.setSessionId(session.getSessionId());
        context.setTenantId(tenantId);
        context.setIpAddress(request.ipAddress());
        context.setUserAgent(request.userAgent());
        context.setDeviceFingerprint(request.deviceFingerprint());
        context.setGeoCountry(request.geoCountry());
        context.setGeoRegion(request.geoRegion());
        context.setGeoCity(request.geoCity());
        sessionContextRepository.save(context);

        // Record session event
        recordEvent(session.getSessionId(), tenantId, "SESSION_CREATED", null);

        // Cache in Redis
        cacheSession(tenantId, session);

        // Publish event
        eventPublisher.publish(InnaITTopics.SESSION_CREATED,
                EventEnvelope.builder()
                        .eventType("session.created")
                        .tenantId(tenantId)
                        .payload(Map.of(
                                "sessionId", session.getSessionId().toString(),
                                "accountId", request.accountId().toString(),
                                "sessionType", session.getSessionType().name()
                        ))
                        .build());

        return session.getSessionId();
    }

    public SessionResponse getSession(UUID sessionId) {
        UUID tenantId = TenantContext.requireTenantId();

        // Try Redis first
        SessionResponse cached = loadSessionFromRedis(tenantId, sessionId);
        if (cached != null) return cached;

        // Fallback to Oracle
        Session session = sessionRepository.findBySessionId(sessionId)
                .orElseThrow(() -> new ResourceNotFoundException("Session", sessionId.toString()));

        SessionContext context = sessionContextRepository.findBySessionId(sessionId).orElse(null);

        // Re-cache
        cacheSession(tenantId, session);

        return toSessionResponse(session, context);
    }

    @Transactional
    public RefreshTokenResponse refreshSession(UUID sessionId, String currentRefreshToken) {
        UUID tenantId = TenantContext.requireTenantId();

        // Find current refresh token by hash
        String tokenHash = hashToken(currentRefreshToken);
        RefreshToken existingToken = refreshTokenRepository.findByTokenHash(tokenHash)
                .orElseThrow(() -> new IllegalArgumentException("Invalid refresh token"));

        // Check if token is already used — potential replay/breach
        if (existingToken.isUsed()) {
            // Revoke entire token family (breach detection)
            refreshTokenRepository.revokeTokenFamily(existingToken.getTokenFamily());
            recordEvent(sessionId, tenantId, "TOKEN_FAMILY_REVOKED",
                    "{\"reason\":\"replay_detected\",\"family\":\"" + existingToken.getTokenFamily() + "\"}");
            throw new IllegalStateException("Refresh token reuse detected — token family revoked");
        }

        // Check expiry
        if (existingToken.getExpiresAt().isBefore(Instant.now())) {
            throw new IllegalStateException("Refresh token expired");
        }

        // Check if token is revoked
        if (existingToken.getRevokedAt() != null) {
            throw new IllegalStateException("Refresh token has been revoked");
        }

        // Mark old token as used
        existingToken.setUsed(true);
        existingToken.setUsedAt(Instant.now());
        refreshTokenRepository.save(existingToken);

        // Generate new refresh token in the same family
        String newTokenValue = generateOpaqueToken();
        RefreshToken newToken = new RefreshToken();
        newToken.setSessionId(sessionId);
        newToken.setTenantId(tenantId);
        newToken.setTokenHash(hashToken(newTokenValue));
        newToken.setTokenFamily(existingToken.getTokenFamily());
        newToken.setExpiresAt(Instant.now().plusSeconds(refreshTokenTtlSeconds));
        refreshTokenRepository.save(newToken);

        // Extend session expiry
        Session session = sessionRepository.findBySessionId(sessionId)
                .orElseThrow(() -> new ResourceNotFoundException("Session", sessionId.toString()));
        session.setLastActivityAt(Instant.now());
        session.setExpiresAt(Instant.now().plusSeconds(sessionTtlSeconds));
        sessionRepository.save(session);

        // Update Redis cache
        cacheSession(tenantId, session);

        recordEvent(sessionId, tenantId, "TOKEN_REFRESHED", null);

        return new RefreshTokenResponse(newTokenValue, newToken.getExpiresAt());
    }

    /**
     * Create the initial refresh token for a new session.
     */
    @Transactional
    public RefreshTokenResponse issueRefreshToken(UUID sessionId) {
        UUID tenantId = TenantContext.requireTenantId();

        String tokenValue = generateOpaqueToken();
        UUID tokenFamily = UUID.randomUUID();

        RefreshToken token = new RefreshToken();
        token.setSessionId(sessionId);
        token.setTenantId(tenantId);
        token.setTokenHash(hashToken(tokenValue));
        token.setTokenFamily(tokenFamily);
        token.setExpiresAt(Instant.now().plusSeconds(refreshTokenTtlSeconds));
        refreshTokenRepository.save(token);

        return new RefreshTokenResponse(tokenValue, token.getExpiresAt());
    }

    @Transactional
    public void revokeSession(UUID sessionId, String reason, String revokedBy) {
        UUID tenantId = TenantContext.requireTenantId();

        Session session = sessionRepository.findBySessionId(sessionId)
                .orElseThrow(() -> new ResourceNotFoundException("Session", sessionId.toString()));

        session.setSessionStatus(SessionStatus.REVOKED);
        session.setTerminatedAt(Instant.now());
        session.setTerminationReason(reason);
        sessionRepository.save(session);

        // Revoke all refresh tokens for this session
        refreshTokenRepository.revokeBySessionId(sessionId);

        // Remove from Redis
        String cacheKey = RedisCacheKeys.sessionKey(tenantId, sessionId);
        redisTemplate.delete(cacheKey);

        recordEvent(sessionId, tenantId, "SESSION_REVOKED",
                "{\"reason\":\"" + reason + "\",\"revokedBy\":\"" + revokedBy + "\"}");

        eventPublisher.publish(InnaITTopics.SESSION_REVOKED,
                EventEnvelope.builder()
                        .eventType("session.revoked")
                        .tenantId(tenantId)
                        .payload(Map.of(
                                "sessionId", sessionId.toString(),
                                "reason", reason
                        ))
                        .build());
    }

    @Transactional
    public void revokeAllSessions(UUID accountId, String reason) {
        UUID tenantId = TenantContext.requireTenantId();

        List<Session> activeSessions = sessionRepository.findActiveSessionsByAccountId(accountId);
        for (Session session : activeSessions) {
            session.setSessionStatus(SessionStatus.REVOKED);
            session.setTerminatedAt(Instant.now());
            session.setTerminationReason(reason);
            sessionRepository.save(session);

            refreshTokenRepository.revokeBySessionId(session.getSessionId());

            String cacheKey = RedisCacheKeys.sessionKey(tenantId, session.getSessionId());
            redisTemplate.delete(cacheKey);

            recordEvent(session.getSessionId(), tenantId, "SESSION_REVOKED",
                    "{\"reason\":\"" + reason + "\",\"bulk\":true}");
        }
    }

    public List<SessionResponse> listActiveSessions(UUID accountId) {
        List<Session> sessions = sessionRepository.findActiveSessionsByAccountId(accountId);
        return sessions.stream().map(s -> {
            SessionContext ctx = sessionContextRepository.findBySessionId(s.getSessionId()).orElse(null);
            return toSessionResponse(s, ctx);
        }).toList();
    }

    @Transactional
    public void updateDeviceContext(UUID sessionId, DeviceContextUpdateRequest request) {
        SessionContext context = sessionContextRepository.findBySessionId(sessionId)
                .orElseThrow(() -> new ResourceNotFoundException("SessionContext", sessionId.toString()));

        if (request.deviceFingerprint() != null) context.setDeviceFingerprint(request.deviceFingerprint());
        if (request.deviceTrustScore() != null) context.setDeviceTrustScore(request.deviceTrustScore());
        if (request.geoCountry() != null) context.setGeoCountry(request.geoCountry());
        if (request.geoRegion() != null) context.setGeoRegion(request.geoRegion());
        if (request.geoCity() != null) context.setGeoCity(request.geoCity());
        sessionContextRepository.save(context);
    }

    // ---- Internal helpers ----

    private void enforceMaxConcurrentSessions(UUID accountId, UUID tenantId) {
        List<Session> activeSessions = sessionRepository
                .findByAccountIdAndSessionStatusOrderByLastActivityAtAsc(accountId, SessionStatus.ACTIVE);

        if (activeSessions.size() >= maxConcurrentSessions) {
            // Revoke oldest (LRU) sessions to make room
            int toRevoke = activeSessions.size() - maxConcurrentSessions + 1;
            for (int i = 0; i < toRevoke; i++) {
                Session oldest = activeSessions.get(i);
                oldest.setSessionStatus(SessionStatus.REVOKED);
                oldest.setTerminatedAt(Instant.now());
                oldest.setTerminationReason("max_concurrent_exceeded");
                sessionRepository.save(oldest);

                refreshTokenRepository.revokeBySessionId(oldest.getSessionId());

                String cacheKey = RedisCacheKeys.sessionKey(tenantId, oldest.getSessionId());
                redisTemplate.delete(cacheKey);

                recordEvent(oldest.getSessionId(), tenantId, "SESSION_EVICTED",
                        "{\"reason\":\"max_concurrent_exceeded\"}");
            }
        }
    }

    private void cacheSession(UUID tenantId, Session session) {
        try {
            String cacheKey = RedisCacheKeys.sessionKey(tenantId, session.getSessionId());
            String json = objectMapper.writeValueAsString(toSessionCacheData(session));
            long ttl = Duration.between(Instant.now(), session.getExpiresAt()).getSeconds();
            if (ttl > 0) {
                redisTemplate.opsForValue().set(cacheKey, json, Duration.ofSeconds(ttl));
            }
        } catch (JsonProcessingException e) {
            // Log but don't fail — Oracle is the source of truth
        }
    }

    private SessionResponse loadSessionFromRedis(UUID tenantId, UUID sessionId) {
        try {
            String cacheKey = RedisCacheKeys.sessionKey(tenantId, sessionId);
            String json = redisTemplate.opsForValue().get(cacheKey);
            if (json != null) {
                return objectMapper.readValue(json, SessionResponse.class);
            }
        } catch (JsonProcessingException e) {
            // Cache miss — fall through to Oracle
        }
        return null;
    }

    private SessionResponse toSessionResponse(Session session, SessionContext context) {
        SessionContextResponse ctxResponse = null;
        if (context != null) {
            ctxResponse = new SessionContextResponse(
                    context.getIpAddress(),
                    context.getUserAgent(),
                    context.getDeviceFingerprint(),
                    context.getGeoCountry(),
                    context.getGeoRegion(),
                    context.getGeoCity(),
                    context.getDeviceTrustScore()
            );
        }
        return new SessionResponse(
                session.getSessionId(),
                session.getAccountId(),
                session.getSessionType().name(),
                session.getSessionStatus().name(),
                session.getAuthLevel(),
                session.getStartedAt(),
                session.getLastActivityAt(),
                session.getExpiresAt(),
                session.getTerminatedAt(),
                session.getTerminationReason(),
                ctxResponse
        );
    }

    private SessionResponse toSessionCacheData(Session session) {
        return new SessionResponse(
                session.getSessionId(),
                session.getAccountId(),
                session.getSessionType().name(),
                session.getSessionStatus().name(),
                session.getAuthLevel(),
                session.getStartedAt(),
                session.getLastActivityAt(),
                session.getExpiresAt(),
                session.getTerminatedAt(),
                session.getTerminationReason(),
                null // Context not cached to keep payload small
        );
    }

    private void recordEvent(UUID sessionId, UUID tenantId, String eventType, String eventData) {
        SessionEvent event = new SessionEvent();
        event.setSessionId(sessionId);
        event.setTenantId(tenantId);
        event.setEventType(eventType);
        event.setEventData(eventData);
        sessionEventRepository.save(event);
    }

    private SessionType parseSessionType(String type) {
        if (type == null || type.isBlank()) return SessionType.INTERACTIVE;
        try {
            return SessionType.valueOf(type.toUpperCase());
        } catch (IllegalArgumentException e) {
            return SessionType.INTERACTIVE;
        }
    }

    private String generateOpaqueToken() {
        byte[] bytes = new byte[32];
        secureRandom.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    String hashToken(String token) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(token.getBytes(StandardCharsets.UTF_8));
            return Base64.getUrlEncoder().withoutPadding().encodeToString(hash);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 not available", e);
        }
    }
}
