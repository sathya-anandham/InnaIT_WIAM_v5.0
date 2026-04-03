package io.innait.wiam.sessionservice.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import io.innait.wiam.common.context.TenantContext;
import io.innait.wiam.common.kafka.EventPublisher;
import io.innait.wiam.sessionservice.dto.*;
import io.innait.wiam.sessionservice.entity.*;
import io.innait.wiam.sessionservice.repository.*;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;

import java.time.Duration;
import java.time.Instant;
import java.util.*;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class SessionServiceTest {

    @Mock private SessionRepository sessionRepository;
    @Mock private SessionContextRepository sessionContextRepository;
    @Mock private RefreshTokenRepository refreshTokenRepository;
    @Mock private SessionEventRepository sessionEventRepository;
    @Mock private StringRedisTemplate redisTemplate;
    @Mock private ValueOperations<String, String> valueOps;
    @Mock private EventPublisher eventPublisher;

    private SessionService sessionService;
    private final ObjectMapper objectMapper = new ObjectMapper().registerModule(new JavaTimeModule());
    private final UUID tenantId = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        TenantContext.setTenantId(tenantId);
        lenient().when(redisTemplate.opsForValue()).thenReturn(valueOps);

        sessionService = new SessionService(
                sessionRepository, sessionContextRepository,
                refreshTokenRepository, sessionEventRepository,
                redisTemplate, objectMapper, eventPublisher);

        // Set config via reflection for testing
        setField(sessionService, "sessionTtlSeconds", 28800L);
        setField(sessionService, "maxConcurrentSessions", 5);
        setField(sessionService, "refreshTokenTtlSeconds", 604800L);
    }

    @AfterEach
    void tearDown() {
        TenantContext.clear();
    }

    @Nested
    class CreateSession {

        @Test
        void shouldCreateSessionSuccessfully() {
            when(sessionRepository.findByAccountIdAndSessionStatusOrderByLastActivityAtAsc(any(), eq(SessionStatus.ACTIVE)))
                    .thenReturn(List.of());
            when(sessionRepository.save(any(Session.class))).thenAnswer(inv -> {
                Session s = inv.getArgument(0);
                if (s.getSessionId() == null) s.setSessionId(UUID.randomUUID());
                return s;
            });
            when(sessionContextRepository.save(any(SessionContext.class))).thenAnswer(inv -> inv.getArgument(0));
            when(sessionEventRepository.save(any(SessionEvent.class))).thenAnswer(inv -> inv.getArgument(0));

            CreateSessionRequest request = new CreateSessionRequest(
                    UUID.randomUUID(), UUID.randomUUID(), List.of("PASSWORD"),
                    1, "INTERACTIVE", "192.168.1.1", "Mozilla/5.0",
                    null, "US", null, null);

            UUID sessionId = sessionService.createSession(request);

            assertThat(sessionId).isNotNull();

            ArgumentCaptor<Session> captor = ArgumentCaptor.forClass(Session.class);
            verify(sessionRepository).save(captor.capture());
            Session saved = captor.getValue();
            assertThat(saved.getAccountId()).isEqualTo(request.accountId());
            assertThat(saved.getSessionType()).isEqualTo(SessionType.INTERACTIVE);
            assertThat(saved.getSessionStatus()).isEqualTo(SessionStatus.ACTIVE);
            assertThat(saved.getTenantId()).isEqualTo(tenantId);
        }

        @Test
        void shouldCreateSessionContext() {
            when(sessionRepository.findByAccountIdAndSessionStatusOrderByLastActivityAtAsc(any(), eq(SessionStatus.ACTIVE)))
                    .thenReturn(List.of());
            when(sessionRepository.save(any())).thenAnswer(inv -> {
                Session s = inv.getArgument(0);
                if (s.getSessionId() == null) s.setSessionId(UUID.randomUUID());
                return s;
            });
            when(sessionContextRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
            when(sessionEventRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            CreateSessionRequest request = new CreateSessionRequest(
                    UUID.randomUUID(), null, null, 1, null,
                    "10.0.0.1", "Chrome", "fp123", "DE", "Bavaria", "Munich");

            sessionService.createSession(request);

            ArgumentCaptor<SessionContext> captor = ArgumentCaptor.forClass(SessionContext.class);
            verify(sessionContextRepository).save(captor.capture());
            SessionContext ctx = captor.getValue();
            assertThat(ctx.getIpAddress()).isEqualTo("10.0.0.1");
            assertThat(ctx.getGeoCountry()).isEqualTo("DE");
            assertThat(ctx.getGeoCity()).isEqualTo("Munich");
        }

        @Test
        void shouldDefaultToInteractiveSessionType() {
            when(sessionRepository.findByAccountIdAndSessionStatusOrderByLastActivityAtAsc(any(), eq(SessionStatus.ACTIVE)))
                    .thenReturn(List.of());
            when(sessionRepository.save(any())).thenAnswer(inv -> {
                Session s = inv.getArgument(0);
                if (s.getSessionId() == null) s.setSessionId(UUID.randomUUID());
                return s;
            });
            when(sessionContextRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
            when(sessionEventRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            CreateSessionRequest request = new CreateSessionRequest(
                    UUID.randomUUID(), null, null, 1, null,
                    "10.0.0.1", null, null, null, null, null);

            sessionService.createSession(request);

            ArgumentCaptor<Session> captor = ArgumentCaptor.forClass(Session.class);
            verify(sessionRepository).save(captor.capture());
            assertThat(captor.getValue().getSessionType()).isEqualTo(SessionType.INTERACTIVE);
        }

        @Test
        void shouldPublishSessionCreatedEvent() {
            when(sessionRepository.findByAccountIdAndSessionStatusOrderByLastActivityAtAsc(any(), eq(SessionStatus.ACTIVE)))
                    .thenReturn(List.of());
            when(sessionRepository.save(any())).thenAnswer(inv -> {
                Session s = inv.getArgument(0);
                if (s.getSessionId() == null) s.setSessionId(UUID.randomUUID());
                return s;
            });
            when(sessionContextRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
            when(sessionEventRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            CreateSessionRequest request = new CreateSessionRequest(
                    UUID.randomUUID(), null, null, 1, "API",
                    "10.0.0.1", null, null, null, null, null);

            sessionService.createSession(request);

            verify(eventPublisher).publish(eq("innait.session.session.created"), any());
        }

        @Test
        void shouldCacheSessionInRedis() {
            when(sessionRepository.findByAccountIdAndSessionStatusOrderByLastActivityAtAsc(any(), eq(SessionStatus.ACTIVE)))
                    .thenReturn(List.of());
            when(sessionRepository.save(any())).thenAnswer(inv -> {
                Session s = inv.getArgument(0);
                s.setSessionId(UUID.randomUUID());
                s.setExpiresAt(Instant.now().plusSeconds(28800));
                s.setStartedAt(Instant.now());
                s.setLastActivityAt(Instant.now());
                return s;
            });
            when(sessionContextRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
            when(sessionEventRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            CreateSessionRequest request = new CreateSessionRequest(
                    UUID.randomUUID(), null, null, 1, null,
                    "10.0.0.1", null, null, null, null, null);

            sessionService.createSession(request);

            verify(valueOps).set(anyString(), anyString(), any(Duration.class));
        }
    }

    @Nested
    class ConcurrentSessionEnforcement {

        @Test
        void shouldRevokeOldestWhenMaxExceeded() {
            setField(sessionService, "maxConcurrentSessions", 2);

            Session oldest = createMockSession(UUID.randomUUID(), Instant.now().minusSeconds(7200));
            Session middle = createMockSession(UUID.randomUUID(), Instant.now().minusSeconds(3600));

            when(sessionRepository.findByAccountIdAndSessionStatusOrderByLastActivityAtAsc(any(), eq(SessionStatus.ACTIVE)))
                    .thenReturn(new ArrayList<>(List.of(oldest, middle)));
            when(sessionRepository.save(any())).thenAnswer(inv -> {
                Session s = inv.getArgument(0);
                if (s.getSessionId() == null) s.setSessionId(UUID.randomUUID());
                return s;
            });
            when(sessionContextRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
            when(sessionEventRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            CreateSessionRequest request = new CreateSessionRequest(
                    UUID.randomUUID(), null, null, 1, null,
                    "10.0.0.1", null, null, null, null, null);

            sessionService.createSession(request);

            assertThat(oldest.getSessionStatus()).isEqualTo(SessionStatus.REVOKED);
            assertThat(oldest.getTerminationReason()).isEqualTo("max_concurrent_exceeded");
        }

        @Test
        void shouldNotRevokeWhenBelowLimit() {
            setField(sessionService, "maxConcurrentSessions", 5);

            when(sessionRepository.findByAccountIdAndSessionStatusOrderByLastActivityAtAsc(any(), eq(SessionStatus.ACTIVE)))
                    .thenReturn(List.of(createMockSession(UUID.randomUUID(), Instant.now())));
            when(sessionRepository.save(any())).thenAnswer(inv -> {
                Session s = inv.getArgument(0);
                if (s.getSessionId() == null) s.setSessionId(UUID.randomUUID());
                return s;
            });
            when(sessionContextRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
            when(sessionEventRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            CreateSessionRequest request = new CreateSessionRequest(
                    UUID.randomUUID(), null, null, 1, null,
                    "10.0.0.1", null, null, null, null, null);

            sessionService.createSession(request);

            // Only the new session save + event saves (no revocations)
            verify(refreshTokenRepository, never()).revokeBySessionId(any());
        }
    }

    @Nested
    class RefreshTokenRotation {

        @Test
        void shouldRotateRefreshTokenSuccessfully() {
            UUID sessionId = UUID.randomUUID();
            String oldTokenValue = "old-token-value";
            String oldTokenHash = sessionService.hashToken(oldTokenValue);
            UUID family = UUID.randomUUID();

            RefreshToken existing = new RefreshToken();
            existing.setRefreshTokenId(UUID.randomUUID());
            existing.setSessionId(sessionId);
            existing.setTenantId(tenantId);
            existing.setTokenHash(oldTokenHash);
            existing.setTokenFamily(family);
            existing.setUsed(false);
            existing.setExpiresAt(Instant.now().plusSeconds(3600));

            when(refreshTokenRepository.findByTokenHash(oldTokenHash)).thenReturn(Optional.of(existing));
            when(refreshTokenRepository.save(any(RefreshToken.class))).thenAnswer(inv -> inv.getArgument(0));

            Session session = createMockSession(sessionId, Instant.now());
            when(sessionRepository.findBySessionId(sessionId)).thenReturn(Optional.of(session));
            when(sessionRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
            when(sessionEventRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            RefreshTokenResponse response = sessionService.refreshSession(sessionId, oldTokenValue);

            assertThat(response.refreshToken()).isNotNull();
            assertThat(response.refreshToken()).isNotEqualTo(oldTokenValue);
            assertThat(existing.isUsed()).isTrue();
            assertThat(existing.getUsedAt()).isNotNull();
        }

        @Test
        void shouldRevokeTokenFamilyOnReuse() {
            UUID sessionId = UUID.randomUUID();
            String oldTokenValue = "reused-token";
            String oldTokenHash = sessionService.hashToken(oldTokenValue);
            UUID family = UUID.randomUUID();

            RefreshToken existing = new RefreshToken();
            existing.setRefreshTokenId(UUID.randomUUID());
            existing.setSessionId(sessionId);
            existing.setTenantId(tenantId);
            existing.setTokenHash(oldTokenHash);
            existing.setTokenFamily(family);
            existing.setUsed(true); // Already used — replay!
            existing.setExpiresAt(Instant.now().plusSeconds(3600));

            when(refreshTokenRepository.findByTokenHash(oldTokenHash)).thenReturn(Optional.of(existing));
            when(sessionEventRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            assertThatThrownBy(() -> sessionService.refreshSession(sessionId, oldTokenValue))
                    .isInstanceOf(IllegalStateException.class)
                    .hasMessageContaining("reuse detected");

            verify(refreshTokenRepository).revokeTokenFamily(family);
        }

        @Test
        void shouldRejectExpiredRefreshToken() {
            String tokenValue = "expired-token";
            String tokenHash = sessionService.hashToken(tokenValue);

            RefreshToken existing = new RefreshToken();
            existing.setUsed(false);
            existing.setExpiresAt(Instant.now().minusSeconds(60)); // expired

            when(refreshTokenRepository.findByTokenHash(tokenHash)).thenReturn(Optional.of(existing));

            assertThatThrownBy(() -> sessionService.refreshSession(UUID.randomUUID(), tokenValue))
                    .isInstanceOf(IllegalStateException.class)
                    .hasMessageContaining("expired");
        }

        @Test
        void shouldRejectRevokedRefreshToken() {
            String tokenValue = "revoked-token";
            String tokenHash = sessionService.hashToken(tokenValue);

            RefreshToken existing = new RefreshToken();
            existing.setUsed(false);
            existing.setExpiresAt(Instant.now().plusSeconds(3600));
            existing.setRevokedAt(Instant.now().minusSeconds(60)); // revoked

            when(refreshTokenRepository.findByTokenHash(tokenHash)).thenReturn(Optional.of(existing));

            assertThatThrownBy(() -> sessionService.refreshSession(UUID.randomUUID(), tokenValue))
                    .isInstanceOf(IllegalStateException.class)
                    .hasMessageContaining("revoked");
        }

        @Test
        void shouldRejectInvalidRefreshToken() {
            when(refreshTokenRepository.findByTokenHash(anyString())).thenReturn(Optional.empty());

            assertThatThrownBy(() -> sessionService.refreshSession(UUID.randomUUID(), "invalid"))
                    .isInstanceOf(IllegalArgumentException.class);
        }

        @Test
        void shouldPreserveFamilyOnRotation() {
            UUID sessionId = UUID.randomUUID();
            String oldTokenValue = "family-token";
            String oldTokenHash = sessionService.hashToken(oldTokenValue);
            UUID family = UUID.randomUUID();

            RefreshToken existing = new RefreshToken();
            existing.setRefreshTokenId(UUID.randomUUID());
            existing.setSessionId(sessionId);
            existing.setTenantId(tenantId);
            existing.setTokenHash(oldTokenHash);
            existing.setTokenFamily(family);
            existing.setUsed(false);
            existing.setExpiresAt(Instant.now().plusSeconds(3600));

            when(refreshTokenRepository.findByTokenHash(oldTokenHash)).thenReturn(Optional.of(existing));

            ArgumentCaptor<RefreshToken> newTokenCaptor = ArgumentCaptor.forClass(RefreshToken.class);
            when(refreshTokenRepository.save(newTokenCaptor.capture())).thenAnswer(inv -> inv.getArgument(0));

            Session session = createMockSession(sessionId, Instant.now());
            when(sessionRepository.findBySessionId(sessionId)).thenReturn(Optional.of(session));
            when(sessionRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
            when(sessionEventRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            sessionService.refreshSession(sessionId, oldTokenValue);

            // The second save is the new token (first is marking old as used)
            List<RefreshToken> saved = newTokenCaptor.getAllValues();
            RefreshToken newToken = saved.get(saved.size() - 1);
            assertThat(newToken.getTokenFamily()).isEqualTo(family);
        }
    }

    @Nested
    class RevokeSession {

        @Test
        void shouldRevokeSessionAndCleanup() {
            UUID sessionId = UUID.randomUUID();
            Session session = createMockSession(sessionId, Instant.now());
            when(sessionRepository.findBySessionId(sessionId)).thenReturn(Optional.of(session));
            when(sessionRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
            when(sessionEventRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
            when(redisTemplate.delete(anyString())).thenReturn(true);

            sessionService.revokeSession(sessionId, "admin_revocation", "admin");

            assertThat(session.getSessionStatus()).isEqualTo(SessionStatus.REVOKED);
            assertThat(session.getTerminationReason()).isEqualTo("admin_revocation");
            verify(refreshTokenRepository).revokeBySessionId(sessionId);
            verify(redisTemplate).delete(anyString());
            verify(eventPublisher).publish(eq("innait.session.session.revoked"), any());
        }
    }

    @Nested
    class RevokeAllSessions {

        @Test
        void shouldRevokeAllActiveSessionsForAccount() {
            UUID accountId = UUID.randomUUID();
            Session s1 = createMockSession(UUID.randomUUID(), Instant.now());
            Session s2 = createMockSession(UUID.randomUUID(), Instant.now());

            when(sessionRepository.findActiveSessionsByAccountId(accountId))
                    .thenReturn(List.of(s1, s2));
            when(sessionRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
            when(sessionEventRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
            when(redisTemplate.delete(anyString())).thenReturn(true);

            sessionService.revokeAllSessions(accountId, "account_terminated");

            assertThat(s1.getSessionStatus()).isEqualTo(SessionStatus.REVOKED);
            assertThat(s2.getSessionStatus()).isEqualTo(SessionStatus.REVOKED);
            verify(refreshTokenRepository, times(2)).revokeBySessionId(any());
        }
    }

    @Nested
    class IssueRefreshToken {

        @Test
        void shouldIssueNewRefreshTokenWithFamily() {
            UUID sessionId = UUID.randomUUID();
            ArgumentCaptor<RefreshToken> captor = ArgumentCaptor.forClass(RefreshToken.class);
            when(refreshTokenRepository.save(captor.capture())).thenAnswer(inv -> inv.getArgument(0));

            RefreshTokenResponse response = sessionService.issueRefreshToken(sessionId);

            assertThat(response.refreshToken()).isNotNull();
            assertThat(response.expiresAt()).isAfter(Instant.now());
            RefreshToken saved = captor.getValue();
            assertThat(saved.getSessionId()).isEqualTo(sessionId);
            assertThat(saved.getTokenFamily()).isNotNull();
            assertThat(saved.isUsed()).isFalse();
        }
    }

    @Nested
    class TokenHashing {

        @Test
        void shouldProduceDeterministicHash() {
            String token = "test-token-123";
            String hash1 = sessionService.hashToken(token);
            String hash2 = sessionService.hashToken(token);
            assertThat(hash1).isEqualTo(hash2);
        }

        @Test
        void shouldProduceDifferentHashesForDifferentTokens() {
            String hash1 = sessionService.hashToken("token-a");
            String hash2 = sessionService.hashToken("token-b");
            assertThat(hash1).isNotEqualTo(hash2);
        }
    }

    // ---- Helpers ----

    private Session createMockSession(UUID sessionId, Instant lastActivity) {
        Session session = new Session();
        session.setSessionId(sessionId);
        session.setTenantId(tenantId);
        session.setAccountId(UUID.randomUUID());
        session.setSessionType(SessionType.INTERACTIVE);
        session.setSessionStatus(SessionStatus.ACTIVE);
        session.setAuthLevel(1);
        session.setStartedAt(lastActivity.minusSeconds(3600));
        session.setLastActivityAt(lastActivity);
        session.setExpiresAt(lastActivity.plusSeconds(28800));
        return session;
    }

    private void setField(Object target, String fieldName, Object value) {
        try {
            var field = target.getClass().getDeclaredField(fieldName);
            field.setAccessible(true);
            field.set(target, value);
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }
}
