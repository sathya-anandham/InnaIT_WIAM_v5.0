package io.innait.wiam.credentialservice.service;

import io.innait.wiam.common.context.CorrelationContext;
import io.innait.wiam.common.context.TenantContext;
import io.innait.wiam.common.event.EventEnvelope;
import io.innait.wiam.common.exception.ResourceNotFoundException;
import io.innait.wiam.common.kafka.EventPublisher;
import io.innait.wiam.common.kafka.InnaITTopics;
import io.innait.wiam.common.redis.RedisCacheKeys;
import io.innait.wiam.credentialservice.entity.AccountBootstrapState;
import io.innait.wiam.credentialservice.entity.AuthMagicLinkEvent;
import io.innait.wiam.credentialservice.entity.MagicLinkEventStatus;
import io.innait.wiam.credentialservice.repository.AccountBootstrapStateRepository;
import io.innait.wiam.credentialservice.repository.AuthMagicLinkEventRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.TimeUnit;

@Service
@Transactional
public class MagicLinkBootstrapService {

    private static final Logger log = LoggerFactory.getLogger(MagicLinkBootstrapService.class);

    private final AccountBootstrapStateRepository bootstrapRepo;
    private final AuthMagicLinkEventRepository eventRepo;
    private final StringRedisTemplate redisTemplate;
    private final EventPublisher eventPublisher;
    private final SecureRandom secureRandom = new SecureRandom();

    @Value("${innait.bootstrap.magic-link.ttl-seconds:300}")
    private long magicLinkTtlSeconds;

    @Value("${innait.bootstrap.magic-link.max-resend:5}")
    private int maxResendLimit;

    @Value("${innait.bootstrap.magic-link.resend-window-seconds:3600}")
    private long resendWindowSeconds;

    public MagicLinkBootstrapService(AccountBootstrapStateRepository bootstrapRepo,
                                      AuthMagicLinkEventRepository eventRepo,
                                      StringRedisTemplate redisTemplate,
                                      EventPublisher eventPublisher) {
        this.bootstrapRepo = bootstrapRepo;
        this.eventRepo = eventRepo;
        this.redisTemplate = redisTemplate;
        this.eventPublisher = eventPublisher;
    }

    @Transactional(readOnly = true)
    public boolean determineIfMagicLinkAllowed(UUID accountId) {
        Optional<AccountBootstrapState> stateOpt = bootstrapRepo.findByAccountId(accountId);
        if (stateOpt.isEmpty()) {
            return false;
        }

        AccountBootstrapState state = stateOpt.get();
        return state.isBootstrapEnabled()
                && state.isFirstLoginPending()
                && !state.isFidoEnrolled();
    }

    public String generateMagicLink(UUID accountId, UUID txnId) {
        AccountBootstrapState state = bootstrapRepo.findByAccountId(accountId)
                .orElseThrow(() -> new ResourceNotFoundException("AccountBootstrapState", accountId.toString()));

        if (!state.isBootstrapEnabled() || !state.isFirstLoginPending()) {
            throw new IllegalStateException("Magic link is not allowed for account: " + accountId);
        }

        // Rate limit check
        Instant since = Instant.now().minus(Duration.ofSeconds(resendWindowSeconds));
        long recentSends = eventRepo.countRecentSendsByAccount(accountId, since);
        if (recentSends >= maxResendLimit) {
            logMagicLinkEvent(accountId, state.getUserId(), txnId, MagicLinkEventStatus.BLOCKED,
                    null, null, "Rate limit exceeded");
            throw new IllegalStateException("Magic link resend limit exceeded for account: " + accountId);
        }

        // Generate secure token
        byte[] tokenBytes = new byte[32];
        secureRandom.nextBytes(tokenBytes);
        String token = Base64.getUrlEncoder().withoutPadding().encodeToString(tokenBytes);

        // Store in Redis with TTL
        String redisKey = RedisCacheKeys.magicLinkKey(txnId);
        String redisValue = accountId + ":" + token;
        redisTemplate.opsForValue().set(redisKey, redisValue, magicLinkTtlSeconds, TimeUnit.SECONDS);

        // Update bootstrap state
        Instant now = Instant.now();
        state.setMagicLinkLastSentAt(now);
        state.setMagicLinkExpiresAt(now.plusSeconds(magicLinkTtlSeconds));
        state.setLastMagicLinkTxnId(txnId);
        bootstrapRepo.save(state);

        log.info("Magic link generated for account [{}] with txnId [{}]", accountId, txnId);
        return token;
    }

    public void sendMagicLink(UUID accountId, String email, UUID txnId) {
        generateMagicLink(accountId, txnId);

        AccountBootstrapState state = bootstrapRepo.findByAccountId(accountId)
                .orElseThrow(() -> new ResourceNotFoundException("AccountBootstrapState", accountId.toString()));

        logMagicLinkEvent(accountId, state.getUserId(), txnId, MagicLinkEventStatus.SENT,
                null, null, null);

        // Publish notification event for email delivery
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("accountId", accountId.toString());
        payload.put("email", email);
        payload.put("txnId", txnId.toString());
        payload.put("type", "MAGIC_LINK");

        EventEnvelope<Map<String, Object>> event = EventEnvelope.<Map<String, Object>>builder()
                .eventType("bootstrap.magiclink.send")
                .tenantId(TenantContext.getTenantId())
                .correlationId(CorrelationContext.getCorrelationId())
                .payload(payload)
                .build();

        eventPublisher.publish(InnaITTopics.MAGIC_LINK_SENT, event);
        log.info("Magic link send requested for account [{}]", accountId);
    }

    public boolean verifyMagicLink(String token, UUID txnId) {
        String redisKey = RedisCacheKeys.magicLinkKey(txnId);
        String storedValue = redisTemplate.opsForValue().get(redisKey);

        if (storedValue == null) {
            log.warn("Magic link expired or not found for txnId [{}]", txnId);
            publishMagicLinkExpiredEvent(txnId);
            return false;
        }

        // Parse stored value: "accountId:token"
        String[] parts = storedValue.split(":", 2);
        if (parts.length != 2) {
            log.error("Invalid magic link data format for txnId [{}]", txnId);
            return false;
        }

        UUID accountId = UUID.fromString(parts[0]);
        String storedToken = parts[1];

        if (!storedToken.equals(token)) {
            AccountBootstrapState state = bootstrapRepo.findByAccountId(accountId).orElse(null);
            UUID userId = state != null ? state.getUserId() : null;
            logMagicLinkEvent(accountId, userId, txnId, MagicLinkEventStatus.FAILED,
                    null, null, "Token mismatch");
            log.warn("Magic link token mismatch for txnId [{}]", txnId);
            return false;
        }

        // Invalidate immediately (single-use)
        redisTemplate.delete(redisKey);

        // Update bootstrap state
        AccountBootstrapState state = bootstrapRepo.findByAccountId(accountId)
                .orElseThrow(() -> new ResourceNotFoundException("AccountBootstrapState", accountId.toString()));

        Instant now = Instant.now();
        state.setMagicLinkLastVerifiedAt(now);
        state.setMagicLinkUsedAt(now);
        bootstrapRepo.save(state);

        logMagicLinkEvent(accountId, state.getUserId(), txnId, MagicLinkEventStatus.VERIFIED,
                null, null, null);

        // Publish verification event
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("accountId", accountId.toString());
        payload.put("userId", state.getUserId().toString());
        payload.put("txnId", txnId.toString());

        EventEnvelope<Map<String, Object>> event = EventEnvelope.<Map<String, Object>>builder()
                .eventType("bootstrap.magiclink.verified")
                .tenantId(TenantContext.getTenantId())
                .correlationId(CorrelationContext.getCorrelationId())
                .payload(payload)
                .build();

        eventPublisher.publish(InnaITTopics.MAGIC_LINK_VERIFIED, event);
        log.info("Magic link verified for account [{}], txnId [{}]", accountId, txnId);
        return true;
    }

    public void invalidateMagicLink(UUID txnId) {
        String redisKey = RedisCacheKeys.magicLinkKey(txnId);
        redisTemplate.delete(redisKey);
        log.info("Magic link invalidated for txnId [{}]", txnId);
    }

    public void disableBootstrapAfterFidoActivation(UUID accountId) {
        AccountBootstrapState state = bootstrapRepo.findByAccountId(accountId)
                .orElseThrow(() -> new ResourceNotFoundException("AccountBootstrapState", accountId.toString()));

        state.setBootstrapEnabled(false);
        state.setFirstLoginPending(false);
        state.setFidoEnrolled(true);
        bootstrapRepo.save(state);

        // Invalidate any outstanding magic link
        if (state.getLastMagicLinkTxnId() != null) {
            invalidateMagicLink(state.getLastMagicLinkTxnId());
        }

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("accountId", accountId.toString());

        EventEnvelope<Map<String, Object>> event = EventEnvelope.<Map<String, Object>>builder()
                .eventType("bootstrap.disabled")
                .tenantId(TenantContext.getTenantId())
                .correlationId(CorrelationContext.getCorrelationId())
                .payload(payload)
                .build();

        eventPublisher.publish(InnaITTopics.BOOTSTRAP_DISABLED, event);
        log.info("Bootstrap disabled for account [{}] after FIDO activation", accountId);
    }

    private void publishMagicLinkExpiredEvent(UUID txnId) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("txnId", txnId.toString());

        EventEnvelope<Map<String, Object>> event = EventEnvelope.<Map<String, Object>>builder()
                .eventType("bootstrap.magiclink.expired")
                .tenantId(TenantContext.getTenantId())
                .correlationId(CorrelationContext.getCorrelationId())
                .payload(payload)
                .build();

        eventPublisher.publish(InnaITTopics.MAGIC_LINK_EXPIRED, event);
        log.info("Magic link expired event published for txnId [{}]", txnId);
    }

    private void logMagicLinkEvent(UUID accountId, UUID userId, UUID txnId,
                                    MagicLinkEventStatus status, String ipAddress,
                                    String userAgent, String detail) {
        AuthMagicLinkEvent event = new AuthMagicLinkEvent();
        event.setAccountId(accountId);
        event.setUserId(userId);
        event.setAuthTxnId(txnId);
        event.setEventStatus(status);
        event.setIpAddress(ipAddress);
        event.setUserAgent(userAgent);
        event.setDetail(detail);
        eventRepo.save(event);
    }
}
