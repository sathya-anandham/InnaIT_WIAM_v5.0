package io.innait.wiam.credentialservice.service;

import io.innait.wiam.common.context.TenantContext;
import io.innait.wiam.common.event.EventEnvelope;
import io.innait.wiam.common.exception.ResourceNotFoundException;
import io.innait.wiam.common.kafka.EventPublisher;
import io.innait.wiam.common.kafka.InnaITTopics;
import io.innait.wiam.common.redis.RedisCacheKeys;
import io.innait.wiam.credentialservice.entity.*;
import io.innait.wiam.credentialservice.repository.AccountBootstrapStateRepository;
import io.innait.wiam.credentialservice.repository.AuthMagicLinkEventRepository;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class MagicLinkBootstrapServiceTest {

    @Mock private AccountBootstrapStateRepository bootstrapRepo;
    @Mock private AuthMagicLinkEventRepository eventRepo;
    @Mock private StringRedisTemplate redisTemplate;
    @Mock private EventPublisher eventPublisher;
    @Mock private ValueOperations<String, String> valueOperations;

    @InjectMocks
    private MagicLinkBootstrapService service;

    private final UUID tenantId = UUID.randomUUID();
    private final UUID accountId = UUID.randomUUID();
    private final UUID userId = UUID.randomUUID();
    private final UUID txnId = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        TenantContext.setTenantId(tenantId);
        ReflectionTestUtils.setField(service, "magicLinkTtlSeconds", 300L);
        ReflectionTestUtils.setField(service, "maxResendLimit", 5);
        ReflectionTestUtils.setField(service, "resendWindowSeconds", 3600L);
    }

    @AfterEach
    void tearDown() {
        TenantContext.clear();
    }

    // ---- determineIfMagicLinkAllowed ----

    @Nested
    @DisplayName("determineIfMagicLinkAllowed")
    class DetermineIfAllowed {

        @Test
        @DisplayName("should return true when bootstrap enabled, first login pending, no FIDO")
        void shouldAllowWhenAllConditionsMet() {
            AccountBootstrapState state = createBootstrapState(true, true, false);
            when(bootstrapRepo.findByAccountId(accountId)).thenReturn(Optional.of(state));

            boolean result = service.determineIfMagicLinkAllowed(accountId);

            assertThat(result).isTrue();
        }

        @Test
        @DisplayName("should return false when bootstrap disabled")
        void shouldDenyWhenBootstrapDisabled() {
            AccountBootstrapState state = createBootstrapState(false, true, false);
            when(bootstrapRepo.findByAccountId(accountId)).thenReturn(Optional.of(state));

            assertThat(service.determineIfMagicLinkAllowed(accountId)).isFalse();
        }

        @Test
        @DisplayName("should return false when first login not pending")
        void shouldDenyWhenFirstLoginDone() {
            AccountBootstrapState state = createBootstrapState(true, false, false);
            when(bootstrapRepo.findByAccountId(accountId)).thenReturn(Optional.of(state));

            assertThat(service.determineIfMagicLinkAllowed(accountId)).isFalse();
        }

        @Test
        @DisplayName("should return false when FIDO already enrolled")
        void shouldDenyWhenFidoEnrolled() {
            AccountBootstrapState state = createBootstrapState(true, true, true);
            when(bootstrapRepo.findByAccountId(accountId)).thenReturn(Optional.of(state));

            assertThat(service.determineIfMagicLinkAllowed(accountId)).isFalse();
        }

        @Test
        @DisplayName("should return false when no bootstrap state exists")
        void shouldDenyWhenNoState() {
            when(bootstrapRepo.findByAccountId(accountId)).thenReturn(Optional.empty());

            assertThat(service.determineIfMagicLinkAllowed(accountId)).isFalse();
        }
    }

    // ---- generateMagicLink ----

    @Nested
    @DisplayName("generateMagicLink")
    class GenerateMagicLink {

        @Test
        @DisplayName("should generate token, store in Redis, update bootstrap state")
        void shouldGenerate() {
            AccountBootstrapState state = createBootstrapState(true, true, false);
            when(bootstrapRepo.findByAccountId(accountId)).thenReturn(Optional.of(state));
            when(eventRepo.countRecentSendsByAccount(eq(accountId), any(Instant.class))).thenReturn(0L);
            when(redisTemplate.opsForValue()).thenReturn(valueOperations);
            when(bootstrapRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));

            String token = service.generateMagicLink(accountId, txnId);

            assertThat(token).isNotBlank();
            verify(valueOperations).set(eq(RedisCacheKeys.magicLinkKey(txnId)), anyString(), eq(300L), any());
            verify(bootstrapRepo).save(any(AccountBootstrapState.class));
            assertThat(state.getLastMagicLinkTxnId()).isEqualTo(txnId);
            assertThat(state.getMagicLinkLastSentAt()).isNotNull();
            assertThat(state.getMagicLinkExpiresAt()).isNotNull();
        }

        @Test
        @DisplayName("should fail when bootstrap state not found")
        void shouldFailNoState() {
            when(bootstrapRepo.findByAccountId(accountId)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> service.generateMagicLink(accountId, txnId))
                    .isInstanceOf(ResourceNotFoundException.class);
        }

        @Test
        @DisplayName("should fail when bootstrap disabled")
        void shouldFailDisabled() {
            AccountBootstrapState state = createBootstrapState(false, true, false);
            when(bootstrapRepo.findByAccountId(accountId)).thenReturn(Optional.of(state));

            assertThatThrownBy(() -> service.generateMagicLink(accountId, txnId))
                    .isInstanceOf(IllegalStateException.class)
                    .hasMessageContaining("not allowed");
        }

        @Test
        @DisplayName("should enforce resend rate limit")
        void shouldEnforceRateLimit() {
            AccountBootstrapState state = createBootstrapState(true, true, false);
            when(bootstrapRepo.findByAccountId(accountId)).thenReturn(Optional.of(state));
            when(eventRepo.countRecentSendsByAccount(eq(accountId), any(Instant.class))).thenReturn(5L);
            when(eventRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));

            assertThatThrownBy(() -> service.generateMagicLink(accountId, txnId))
                    .isInstanceOf(IllegalStateException.class)
                    .hasMessageContaining("resend limit exceeded");
        }
    }

    // ---- verifyMagicLink ----

    @Nested
    @DisplayName("verifyMagicLink")
    class VerifyMagicLink {

        @Test
        @DisplayName("should verify valid token, invalidate, and update state")
        void shouldVerifyValid() {
            String token = "valid-token-abc";
            String redisValue = accountId + ":" + token;
            AccountBootstrapState state = createBootstrapState(true, true, false);

            when(redisTemplate.opsForValue()).thenReturn(valueOperations);
            when(valueOperations.get(RedisCacheKeys.magicLinkKey(txnId))).thenReturn(redisValue);
            when(redisTemplate.delete(RedisCacheKeys.magicLinkKey(txnId))).thenReturn(true);
            when(bootstrapRepo.findByAccountId(accountId)).thenReturn(Optional.of(state));
            when(bootstrapRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));
            when(eventRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));
            when(eventPublisher.publish(anyString(), any()))
                    .thenReturn(CompletableFuture.completedFuture(null));

            boolean result = service.verifyMagicLink(token, txnId);

            assertThat(result).isTrue();
            // Token invalidated (single-use)
            verify(redisTemplate).delete(RedisCacheKeys.magicLinkKey(txnId));
            // State updated
            assertThat(state.getMagicLinkLastVerifiedAt()).isNotNull();
            assertThat(state.getMagicLinkUsedAt()).isNotNull();
            // Event published
            verify(eventPublisher).publish(eq(InnaITTopics.MAGIC_LINK_VERIFIED), any(EventEnvelope.class));
            // Audit logged
            verify(eventRepo).save(any(AuthMagicLinkEvent.class));
        }

        @Test
        @DisplayName("expired magic link should fail and publish expired event")
        void shouldFailExpired() {
            when(redisTemplate.opsForValue()).thenReturn(valueOperations);
            when(valueOperations.get(RedisCacheKeys.magicLinkKey(txnId))).thenReturn(null);
            when(eventPublisher.publish(anyString(), any()))
                    .thenReturn(CompletableFuture.completedFuture(null));

            boolean result = service.verifyMagicLink("any-token", txnId);

            assertThat(result).isFalse();
            verify(eventPublisher).publish(eq(InnaITTopics.MAGIC_LINK_EXPIRED), any(EventEnvelope.class));
        }

        @Test
        @DisplayName("reused magic link should fail (single-use enforcement)")
        void shouldFailReused() {
            // First verify succeeds and deletes from Redis
            // Second verify finds null in Redis -> fails
            when(redisTemplate.opsForValue()).thenReturn(valueOperations);
            when(valueOperations.get(RedisCacheKeys.magicLinkKey(txnId))).thenReturn(null);
            when(eventPublisher.publish(anyString(), any()))
                    .thenReturn(CompletableFuture.completedFuture(null));

            boolean result = service.verifyMagicLink("already-used-token", txnId);

            assertThat(result).isFalse();
        }

        @Test
        @DisplayName("magic link token mismatch should fail and log event")
        void shouldFailTokenMismatch() {
            String redisValue = accountId + ":correct-token";
            AccountBootstrapState state = createBootstrapState(true, true, false);

            when(redisTemplate.opsForValue()).thenReturn(valueOperations);
            when(valueOperations.get(RedisCacheKeys.magicLinkKey(txnId))).thenReturn(redisValue);
            when(bootstrapRepo.findByAccountId(accountId)).thenReturn(Optional.of(state));
            when(eventRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));

            boolean result = service.verifyMagicLink("wrong-token", txnId);

            assertThat(result).isFalse();

            ArgumentCaptor<AuthMagicLinkEvent> captor = ArgumentCaptor.forClass(AuthMagicLinkEvent.class);
            verify(eventRepo).save(captor.capture());
            assertThat(captor.getValue().getEventStatus()).isEqualTo(MagicLinkEventStatus.FAILED);
            assertThat(captor.getValue().getDetail()).isEqualTo("Token mismatch");
        }
    }

    // ---- disableBootstrapAfterFidoActivation ----

    @Nested
    @DisplayName("disableBootstrapAfterFidoActivation")
    class DisableBootstrap {

        @Test
        @DisplayName("should disable bootstrap, mark FIDO enrolled, invalidate magic link")
        void shouldDisableAfterFido() {
            AccountBootstrapState state = createBootstrapState(true, true, false);
            state.setLastMagicLinkTxnId(txnId);
            when(bootstrapRepo.findByAccountId(accountId)).thenReturn(Optional.of(state));
            when(bootstrapRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));
            when(redisTemplate.delete(anyString())).thenReturn(true);
            when(eventPublisher.publish(anyString(), any()))
                    .thenReturn(CompletableFuture.completedFuture(null));

            service.disableBootstrapAfterFidoActivation(accountId);

            assertThat(state.isBootstrapEnabled()).isFalse();
            assertThat(state.isFirstLoginPending()).isFalse();
            assertThat(state.isFidoEnrolled()).isTrue();

            // Outstanding magic link invalidated
            verify(redisTemplate).delete(RedisCacheKeys.magicLinkKey(txnId));

            // Event published
            verify(eventPublisher).publish(eq(InnaITTopics.BOOTSTRAP_DISABLED), any(EventEnvelope.class));
        }

        @Test
        @DisplayName("should skip magic link invalidation when no outstanding txnId")
        void shouldSkipInvalidationWhenNoTxn() {
            AccountBootstrapState state = createBootstrapState(true, true, false);
            state.setLastMagicLinkTxnId(null);
            when(bootstrapRepo.findByAccountId(accountId)).thenReturn(Optional.of(state));
            when(bootstrapRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));
            when(eventPublisher.publish(anyString(), any()))
                    .thenReturn(CompletableFuture.completedFuture(null));

            service.disableBootstrapAfterFidoActivation(accountId);

            verify(redisTemplate, never()).delete(anyString());
        }
    }

    // ---- invalidateMagicLink ----

    @Test
    @DisplayName("should delete magic link from Redis")
    void shouldInvalidate() {
        when(redisTemplate.delete(RedisCacheKeys.magicLinkKey(txnId))).thenReturn(true);

        service.invalidateMagicLink(txnId);

        verify(redisTemplate).delete(RedisCacheKeys.magicLinkKey(txnId));
    }

    // ---- Helpers ----

    private AccountBootstrapState createBootstrapState(boolean enabled, boolean firstLoginPending,
                                                        boolean fidoEnrolled) {
        AccountBootstrapState state = new AccountBootstrapState();
        state.setId(UUID.randomUUID());
        state.setTenantId(tenantId);
        state.setAccountId(accountId);
        state.setUserId(userId);
        state.setBootstrapMethod(BootstrapMethod.MAGIC_LINK);
        state.setBootstrapEnabled(enabled);
        state.setFirstLoginPending(firstLoginPending);
        state.setFidoEnrolled(fidoEnrolled);
        return state;
    }
}
