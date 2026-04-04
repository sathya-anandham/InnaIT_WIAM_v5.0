package io.innait.wiam.credentialservice.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import io.innait.wiam.common.event.EventEnvelope;
import io.innait.wiam.common.kafka.EventPublisher;
import io.innait.wiam.common.redis.RedisCacheKeys;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;

import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class BootstrapSessionServiceTest {

    @Mock private StringRedisTemplate redisTemplate;
    @Mock private EventPublisher eventPublisher;
    @Mock private ValueOperations<String, String> valueOperations;

    private BootstrapSessionService service;
    private final ObjectMapper objectMapper = new ObjectMapper();

    private final UUID accountId = UUID.randomUUID();
    private final UUID tenantId = UUID.randomUUID();
    private final UUID userId = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        service = new BootstrapSessionService(redisTemplate, objectMapper, eventPublisher);
    }

    // ---- createRestrictedBootstrapSession ----

    @Nested
    @DisplayName("createRestrictedBootstrapSession")
    class CreateSession {

        @Test
        @DisplayName("should create session, store in Redis with TTL, and publish event")
        void shouldCreate() {
            when(redisTemplate.opsForValue()).thenReturn(valueOperations);
            when(eventPublisher.publish(anyString(), any()))
                    .thenReturn(CompletableFuture.completedFuture(null));

            UUID sessionId = service.createRestrictedBootstrapSession(accountId, tenantId, userId);

            assertThat(sessionId).isNotNull();
            verify(valueOperations).set(
                    eq(RedisCacheKeys.bootstrapSessionKey(sessionId)),
                    anyString(),
                    eq(RedisCacheKeys.BOOTSTRAP_SESSION_TTL),
                    eq(TimeUnit.SECONDS));
            verify(eventPublisher).publish(anyString(), any(EventEnvelope.class));
        }
    }

    // ---- validateBootstrapSessionForOnboarding ----

    @Nested
    @DisplayName("validateBootstrapSessionForOnboarding")
    class ValidateSession {

        @Test
        @DisplayName("should return session data for valid bootstrap session")
        void shouldValidate() throws Exception {
            UUID sessionId = UUID.randomUUID();
            Map<String, String> sessionData = Map.of(
                    "sessionId", sessionId.toString(),
                    "accountId", accountId.toString(),
                    "tenantId", tenantId.toString(),
                    "userId", userId.toString(),
                    "type", "BOOTSTRAP",
                    "restricted", "true"
            );
            String json = objectMapper.writeValueAsString(sessionData);

            when(redisTemplate.opsForValue()).thenReturn(valueOperations);
            when(valueOperations.get(RedisCacheKeys.bootstrapSessionKey(sessionId))).thenReturn(json);

            Map<String, String> result = service.validateBootstrapSessionForOnboarding(sessionId);

            assertThat(result.get("type")).isEqualTo("BOOTSTRAP");
            assertThat(result.get("restricted")).isEqualTo("true");
            assertThat(result.get("accountId")).isEqualTo(accountId.toString());
        }

        @Test
        @DisplayName("should fail when session not found or expired")
        void shouldFailExpired() {
            UUID sessionId = UUID.randomUUID();
            when(redisTemplate.opsForValue()).thenReturn(valueOperations);
            when(valueOperations.get(RedisCacheKeys.bootstrapSessionKey(sessionId))).thenReturn(null);

            assertThatThrownBy(() -> service.validateBootstrapSessionForOnboarding(sessionId))
                    .isInstanceOf(IllegalStateException.class)
                    .hasMessageContaining("not found or expired");
        }

        @Test
        @DisplayName("should fail when session type is not BOOTSTRAP")
        void shouldFailWrongType() throws Exception {
            UUID sessionId = UUID.randomUUID();
            Map<String, String> sessionData = Map.of(
                    "type", "INTERACTIVE",
                    "restricted", "true"
            );
            String json = objectMapper.writeValueAsString(sessionData);

            when(redisTemplate.opsForValue()).thenReturn(valueOperations);
            when(valueOperations.get(RedisCacheKeys.bootstrapSessionKey(sessionId))).thenReturn(json);

            assertThatThrownBy(() -> service.validateBootstrapSessionForOnboarding(sessionId))
                    .isInstanceOf(IllegalStateException.class)
                    .hasMessageContaining("Invalid session type");
        }

        @Test
        @DisplayName("should fail when session is not restricted")
        void shouldFailNotRestricted() throws Exception {
            UUID sessionId = UUID.randomUUID();
            Map<String, String> sessionData = Map.of(
                    "type", "BOOTSTRAP",
                    "restricted", "false"
            );
            String json = objectMapper.writeValueAsString(sessionData);

            when(redisTemplate.opsForValue()).thenReturn(valueOperations);
            when(valueOperations.get(RedisCacheKeys.bootstrapSessionKey(sessionId))).thenReturn(json);

            assertThatThrownBy(() -> service.validateBootstrapSessionForOnboarding(sessionId))
                    .isInstanceOf(IllegalStateException.class)
                    .hasMessageContaining("not a restricted bootstrap session");
        }
    }

    // ---- expireBootstrapSessionAfterFidoActivation ----

    @Test
    @DisplayName("should delete session from Redis")
    void shouldExpireSession() {
        UUID sessionId = UUID.randomUUID();
        when(redisTemplate.delete(RedisCacheKeys.bootstrapSessionKey(sessionId))).thenReturn(true);

        service.expireBootstrapSessionAfterFidoActivation(sessionId);

        verify(redisTemplate).delete(RedisCacheKeys.bootstrapSessionKey(sessionId));
    }
}
