package io.innait.wiam.authorchestrator.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import io.innait.wiam.authorchestrator.dto.*;
import io.innait.wiam.authorchestrator.entity.AuthResult;
import io.innait.wiam.authorchestrator.entity.AuthTransaction;
import io.innait.wiam.authorchestrator.repository.AuthChallengeRepository;
import io.innait.wiam.authorchestrator.repository.AuthResultRepository;
import io.innait.wiam.authorchestrator.repository.AuthTransactionRepository;
import io.innait.wiam.authorchestrator.repository.LoginAttemptRepository;
import io.innait.wiam.authorchestrator.statemachine.AuthState;
import io.innait.wiam.authorchestrator.statemachine.AuthStateMachine;
import io.innait.wiam.common.context.CorrelationContext;
import io.innait.wiam.common.context.TenantContext;
import io.innait.wiam.common.event.EventEnvelope;
import io.innait.wiam.common.exception.ResourceNotFoundException;
import io.innait.wiam.common.kafka.EventPublisher;
import io.innait.wiam.common.kafka.InnaITTopics;
import io.innait.wiam.common.redis.RedisCacheKeys;
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

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AuthOrchestrationServiceTest {

    @Mock private AuthTransactionRepository txnRepo;
    @Mock private AuthChallengeRepository challengeRepo;
    @Mock private AuthResultRepository resultRepo;
    @Mock private LoginAttemptRepository loginAttemptRepo;
    @Mock private StringRedisTemplate redisTemplate;
    @Mock private ValueOperations<String, String> valueOperations;
    @Mock private EventPublisher eventPublisher;

    private AuthOrchestrationService service;
    private final ObjectMapper objectMapper = new ObjectMapper().registerModule(new JavaTimeModule());
    private final AuthStateMachine stateMachine = new AuthStateMachine();

    private final UUID tenantId = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        TenantContext.setTenantId(tenantId);
        CorrelationContext.setCorrelationId(UUID.randomUUID());
        service = new AuthOrchestrationService(
                stateMachine, txnRepo, challengeRepo, resultRepo, loginAttemptRepo,
                redisTemplate, eventPublisher, objectMapper
        );
    }

    @AfterEach
    void tearDown() {
        TenantContext.clear();
        CorrelationContext.clear();
    }

    // ---- Initiate Auth ----

    @Nested
    class InitiateAuth {

        @Test
        void shouldCreateTransactionAndReturnPrimaryChallenge() {
            when(redisTemplate.opsForValue()).thenReturn(valueOperations);
            when(txnRepo.save(any(AuthTransaction.class))).thenAnswer(inv -> inv.getArgument(0));

            AuthInitiateRequest request = new AuthInitiateRequest(
                    "user@test.com", "WEB", "192.168.1.1", "Mozilla/5.0");

            AuthInitiateResponse response = service.initiateAuth(request);

            assertThat(response.txnId()).isNotNull();
            assertThat(response.state()).isEqualTo("PRIMARY_CHALLENGE");
            assertThat(response.availableMethods()).contains("PASSWORD", "FIDO");
        }

        @Test
        void shouldSaveTransactionToOracle() {
            when(redisTemplate.opsForValue()).thenReturn(valueOperations);
            ArgumentCaptor<AuthTransaction> captor = ArgumentCaptor.forClass(AuthTransaction.class);
            when(txnRepo.save(captor.capture())).thenAnswer(inv -> inv.getArgument(0));

            service.initiateAuth(new AuthInitiateRequest("user@test.com", "MOBILE", "10.0.0.1", null));

            // save called twice: once for INITIATED, once for PRIMARY_CHALLENGE
            verify(txnRepo, times(2)).save(any(AuthTransaction.class));
            AuthTransaction lastSaved = captor.getAllValues().get(1);
            assertThat(lastSaved.getCurrentState()).isEqualTo(AuthState.PRIMARY_CHALLENGE);
            assertThat(lastSaved.getTenantId()).isEqualTo(tenantId);
        }

        @Test
        void shouldCacheSessionInRedis() {
            when(redisTemplate.opsForValue()).thenReturn(valueOperations);
            when(txnRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));

            service.initiateAuth(new AuthInitiateRequest("user@test.com", "WEB", null, null));

            // Session saved twice (INITIATED then PRIMARY_CHALLENGE)
            verify(valueOperations, times(2)).set(
                    argThat(key -> key.startsWith("authn:txn:")),
                    anyString(),
                    anyLong(),
                    eq(TimeUnit.SECONDS)
            );
        }

        @Test
        void shouldPublishAuthStartedEvent() {
            when(redisTemplate.opsForValue()).thenReturn(valueOperations);
            when(txnRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));

            service.initiateAuth(new AuthInitiateRequest("user@test.com", "WEB", null, null));

            verify(eventPublisher).publish(eq(InnaITTopics.AUTH_STARTED), any(EventEnvelope.class));
        }

        @Test
        void shouldDefaultToWebChannelType() {
            when(redisTemplate.opsForValue()).thenReturn(valueOperations);
            ArgumentCaptor<AuthTransaction> captor = ArgumentCaptor.forClass(AuthTransaction.class);
            when(txnRepo.save(captor.capture())).thenAnswer(inv -> inv.getArgument(0));

            service.initiateAuth(new AuthInitiateRequest("user@test.com", null, null, null));

            assertThat(captor.getValue().getChannelType()).isEqualTo(
                    io.innait.wiam.authorchestrator.entity.ChannelType.WEB);
        }

        @Test
        void shouldHandleInvalidChannelTypeGracefully() {
            when(redisTemplate.opsForValue()).thenReturn(valueOperations);
            when(txnRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));

            AuthInitiateResponse response = service.initiateAuth(
                    new AuthInitiateRequest("user@test.com", "INVALID", null, null));

            assertThat(response).isNotNull();
        }
    }

    // ---- Submit Primary Factor ----

    @Nested
    class SubmitPrimaryFactor {

        @Test
        void shouldCompleteWithoutMfaWhenNotRequired() {
            AuthSessionData session = buildSession(AuthState.PRIMARY_CHALLENGE, false);
            mockRedisLoad(session);
            when(txnRepo.findByAuthTxnId(session.getTxnId())).thenReturn(Optional.of(buildTxn(session)));
            when(txnRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));
            when(loginAttemptRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));
            when(resultRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));

            FactorSubmitRequest request = new FactorSubmitRequest(
                    session.getTxnId(), "PASSWORD", Map.of("password", "secret123"));

            PrimaryFactorResponse response = service.submitPrimaryFactor(request);

            assertThat(response.status()).isEqualTo("AUTHENTICATED");
            assertThat(response.mfaRequired()).isFalse();
            assertThat(response.tokens()).isNotNull();
            assertThat(response.tokens().accessToken()).startsWith("access-token-");
        }

        @Test
        void shouldTransitionToMfaChallengeWhenRequired() {
            AuthSessionData session = buildSession(AuthState.PRIMARY_CHALLENGE, true);
            mockRedisLoad(session);
            when(txnRepo.findByAuthTxnId(session.getTxnId())).thenReturn(Optional.of(buildTxn(session)));
            when(txnRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));
            when(loginAttemptRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));

            FactorSubmitRequest request = new FactorSubmitRequest(
                    session.getTxnId(), "PASSWORD", Map.of("password", "secret123"));

            PrimaryFactorResponse response = service.submitPrimaryFactor(request);

            assertThat(response.status()).isEqualTo("MFA_REQUIRED");
            assertThat(response.mfaRequired()).isTrue();
            assertThat(response.availableMfaMethods()).contains("TOTP", "FIDO", "SOFTTOKEN", "BACKUP_CODE");
            assertThat(response.tokens()).isNull();
        }

        @Test
        void shouldIncrementFailedAttemptsOnBadPassword() {
            AuthSessionData session = buildSession(AuthState.PRIMARY_CHALLENGE, true);
            session.setMaxPrimaryAttempts(5);
            mockRedisLoad(session);
            when(loginAttemptRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));

            FactorSubmitRequest request = new FactorSubmitRequest(
                    session.getTxnId(), "PASSWORD", Map.of("password", ""));

            PrimaryFactorResponse response = service.submitPrimaryFactor(request);

            assertThat(response.status()).isEqualTo("INVALID_CREDENTIALS");
            // Verify session was saved with incremented failure count
            verify(redisTemplate.opsForValue(), atLeastOnce()).set(
                    anyString(), anyString(), anyLong(), any(TimeUnit.class));
        }

        @Test
        void shouldLockAccountAfterMaxFailedAttempts() {
            AuthSessionData session = buildSession(AuthState.PRIMARY_CHALLENGE, true);
            session.setMaxPrimaryAttempts(1); // Only 1 attempt allowed
            session.setFailedPrimaryAttempts(0);
            session.setAccountId(UUID.randomUUID());
            mockRedisLoad(session);
            when(txnRepo.findByAuthTxnId(session.getTxnId())).thenReturn(Optional.of(buildTxn(session)));
            when(txnRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));
            when(loginAttemptRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));
            when(resultRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));

            FactorSubmitRequest request = new FactorSubmitRequest(
                    session.getTxnId(), "PASSWORD", Map.of("password", ""));

            PrimaryFactorResponse response = service.submitPrimaryFactor(request);

            assertThat(response.status()).isEqualTo("ACCOUNT_LOCKED");
            // Verify lockout event published
            verify(eventPublisher).publish(eq(InnaITTopics.ACCOUNT_STATUS_CHANGED), any(EventEnvelope.class));
            verify(eventPublisher).publish(eq(InnaITTopics.AUTH_FAILED), any(EventEnvelope.class));
        }

        @Test
        void shouldRejectMissingPassword() {
            AuthSessionData session = buildSession(AuthState.PRIMARY_CHALLENGE, false);
            mockRedisLoad(session);
            when(loginAttemptRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));

            FactorSubmitRequest request = new FactorSubmitRequest(
                    session.getTxnId(), "PASSWORD", Map.of());

            PrimaryFactorResponse response = service.submitPrimaryFactor(request);

            assertThat(response.status()).isEqualTo("INVALID_CREDENTIALS");
        }

        @Test
        void shouldRejectUnsupportedPrimaryFactor() {
            AuthSessionData session = buildSession(AuthState.PRIMARY_CHALLENGE, false);
            mockRedisLoad(session);

            FactorSubmitRequest request = new FactorSubmitRequest(
                    session.getTxnId(), "TOTP", Map.of("code", "123456"));

            assertThatThrownBy(() -> service.submitPrimaryFactor(request))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("Unsupported primary factor");
        }

        @Test
        void shouldPublishAuthSucceededEventOnCompletion() {
            AuthSessionData session = buildSession(AuthState.PRIMARY_CHALLENGE, false);
            mockRedisLoad(session);
            when(txnRepo.findByAuthTxnId(session.getTxnId())).thenReturn(Optional.of(buildTxn(session)));
            when(txnRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));
            when(loginAttemptRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));
            when(resultRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));

            service.submitPrimaryFactor(new FactorSubmitRequest(
                    session.getTxnId(), "PASSWORD", Map.of("password", "test")));

            verify(eventPublisher).publish(eq(InnaITTopics.AUTH_SUCCEEDED), any(EventEnvelope.class));
        }
    }

    // ---- Submit MFA Factor ----

    @Nested
    class SubmitMfaFactor {

        @Test
        void shouldCompleteTotpMfa() {
            AuthSessionData session = buildSession(AuthState.MFA_CHALLENGE, true);
            mockRedisLoad(session);
            when(txnRepo.findByAuthTxnId(session.getTxnId())).thenReturn(Optional.of(buildTxn(session)));
            when(txnRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));
            when(resultRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));

            FactorSubmitRequest request = new FactorSubmitRequest(
                    session.getTxnId(), "TOTP", Map.of("code", "123456"));

            MfaFactorResponse response = service.submitMfaFactor(request);

            assertThat(response.status()).isEqualTo("AUTHENTICATED");
            assertThat(response.tokens()).isNotNull();
        }

        @Test
        void shouldCompleteFidoMfa() {
            AuthSessionData session = buildSession(AuthState.MFA_CHALLENGE, true);
            mockRedisLoad(session);
            when(txnRepo.findByAuthTxnId(session.getTxnId())).thenReturn(Optional.of(buildTxn(session)));
            when(txnRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));
            when(resultRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));

            FactorSubmitRequest request = new FactorSubmitRequest(
                    session.getTxnId(), "FIDO", Map.of("credentialId", "abc", "authenticatorData", "xyz"));

            MfaFactorResponse response = service.submitMfaFactor(request);

            assertThat(response.status()).isEqualTo("AUTHENTICATED");
        }

        @Test
        void shouldCompleteSoftTokenMfa() {
            AuthSessionData session = buildSession(AuthState.MFA_CHALLENGE, true);
            mockRedisLoad(session);
            when(txnRepo.findByAuthTxnId(session.getTxnId())).thenReturn(Optional.of(buildTxn(session)));
            when(txnRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));
            when(resultRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));

            FactorSubmitRequest request = new FactorSubmitRequest(
                    session.getTxnId(), "SOFTTOKEN", Map.of("challengeId", "c1", "signedResponse", "sig"));

            MfaFactorResponse response = service.submitMfaFactor(request);

            assertThat(response.status()).isEqualTo("AUTHENTICATED");
        }

        @Test
        void shouldCompleteBackupCodeMfa() {
            AuthSessionData session = buildSession(AuthState.MFA_CHALLENGE, true);
            mockRedisLoad(session);
            when(txnRepo.findByAuthTxnId(session.getTxnId())).thenReturn(Optional.of(buildTxn(session)));
            when(txnRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));
            when(resultRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));

            FactorSubmitRequest request = new FactorSubmitRequest(
                    session.getTxnId(), "BACKUP_CODE", Map.of("code", "ABCD1234"));

            MfaFactorResponse response = service.submitMfaFactor(request);

            assertThat(response.status()).isEqualTo("AUTHENTICATED");
        }

        @Test
        void shouldFailAfterMaxMfaAttempts() {
            AuthSessionData session = buildSession(AuthState.MFA_CHALLENGE, true);
            session.setMaxMfaAttempts(1);
            mockRedisLoad(session);
            when(txnRepo.findByAuthTxnId(session.getTxnId())).thenReturn(Optional.of(buildTxn(session)));
            when(txnRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));
            when(resultRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));

            FactorSubmitRequest request = new FactorSubmitRequest(
                    session.getTxnId(), "TOTP", Map.of("code", ""));

            MfaFactorResponse response = service.submitMfaFactor(request);

            assertThat(response.status()).isEqualTo("ACCOUNT_LOCKED");
            verify(eventPublisher).publish(eq(InnaITTopics.AUTH_FAILED), any(EventEnvelope.class));
        }

        @Test
        void shouldRejectMfaWhenNotInMfaChallengeState() {
            AuthSessionData session = buildSession(AuthState.PRIMARY_CHALLENGE, true);
            mockRedisLoad(session);

            FactorSubmitRequest request = new FactorSubmitRequest(
                    session.getTxnId(), "TOTP", Map.of("code", "123456"));

            assertThatThrownBy(() -> service.submitMfaFactor(request))
                    .isInstanceOf(IllegalStateException.class)
                    .hasMessageContaining("not in MFA_CHALLENGE state");
        }
    }

    // ---- Get Auth Status ----

    @Nested
    class GetAuthStatus {

        @Test
        void shouldReturnStatusFromRedis() {
            AuthSessionData session = buildSession(AuthState.PRIMARY_CHALLENGE, true);
            mockRedisLoad(session);

            AuthStatusResponse response = service.getAuthStatus(session.getTxnId());

            assertThat(response.txnId()).isEqualTo(session.getTxnId());
            assertThat(response.state()).isEqualTo("PRIMARY_CHALLENGE");
        }

        @Test
        void shouldFallbackToOracleWhenRedisEmpty() {
            UUID txnId = UUID.randomUUID();
            when(redisTemplate.opsForValue()).thenReturn(valueOperations);
            when(valueOperations.get(RedisCacheKeys.authTxnKey(txnId))).thenReturn(null);

            AuthTransaction txn = new AuthTransaction();
            txn.setAuthTxnId(txnId);
            txn.setCurrentState(AuthState.COMPLETED);
            txn.setStartedAt(Instant.now().minus(5, ChronoUnit.MINUTES));
            txn.setExpiresAt(Instant.now().plus(5, ChronoUnit.MINUTES));
            txn.setCompletedAt(Instant.now());
            when(txnRepo.findByAuthTxnId(txnId)).thenReturn(Optional.of(txn));

            AuthStatusResponse response = service.getAuthStatus(txnId);

            assertThat(response.state()).isEqualTo("COMPLETED");
            assertThat(response.completedAt()).isNotNull();
        }

        @Test
        void shouldThrowWhenNotFoundAnywhere() {
            UUID txnId = UUID.randomUUID();
            when(redisTemplate.opsForValue()).thenReturn(valueOperations);
            when(valueOperations.get(RedisCacheKeys.authTxnKey(txnId))).thenReturn(null);
            when(txnRepo.findByAuthTxnId(txnId)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> service.getAuthStatus(txnId))
                    .isInstanceOf(ResourceNotFoundException.class);
        }
    }

    // ---- Abort ----

    @Nested
    class AbortAuth {

        @Test
        void shouldAbortActiveTransaction() {
            AuthSessionData session = buildSession(AuthState.PRIMARY_CHALLENGE, true);
            mockRedisLoad(session);
            when(txnRepo.findByAuthTxnId(session.getTxnId())).thenReturn(Optional.of(buildTxn(session)));
            when(txnRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));
            when(resultRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));

            AuthStatusResponse response = service.abortAuth(session.getTxnId());

            assertThat(response.state()).isEqualTo("ABORTED");
            verify(resultRepo).save(any(AuthResult.class));
        }

        @Test
        void shouldRejectAbortOnCompletedTransaction() {
            AuthSessionData session = buildSession(AuthState.COMPLETED, false);
            mockRedisLoad(session);

            assertThatThrownBy(() -> service.abortAuth(session.getTxnId()))
                    .isInstanceOf(IllegalStateException.class)
                    .hasMessageContaining("terminal state");
        }

        @Test
        void shouldAbortFromMfaChallenge() {
            AuthSessionData session = buildSession(AuthState.MFA_CHALLENGE, true);
            mockRedisLoad(session);
            when(txnRepo.findByAuthTxnId(session.getTxnId())).thenReturn(Optional.of(buildTxn(session)));
            when(txnRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));
            when(resultRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));

            AuthStatusResponse response = service.abortAuth(session.getTxnId());

            assertThat(response.state()).isEqualTo("ABORTED");
        }
    }

    // ---- Timeout/Expiry ----

    @Nested
    class TimeoutHandling {

        @Test
        void shouldRejectExpiredTransaction() {
            AuthSessionData session = buildSession(AuthState.PRIMARY_CHALLENGE, true);
            session.setExpiresAt(Instant.now().minus(1, ChronoUnit.MINUTES)); // already expired
            mockRedisLoad(session);
            when(txnRepo.findByAuthTxnId(session.getTxnId())).thenReturn(Optional.of(buildTxn(session)));
            when(txnRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));

            FactorSubmitRequest request = new FactorSubmitRequest(
                    session.getTxnId(), "PASSWORD", Map.of("password", "test"));

            assertThatThrownBy(() -> service.submitPrimaryFactor(request))
                    .isInstanceOf(IllegalStateException.class)
                    .hasMessageContaining("expired");
        }
    }

    // ---- End-to-end Flows ----

    @Nested
    class EndToEndFlows {

        @Test
        void passwordPlusTotpFlow() {
            // 1. Initiate
            when(redisTemplate.opsForValue()).thenReturn(valueOperations);
            when(txnRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));

            AuthInitiateResponse initResponse = service.initiateAuth(
                    new AuthInitiateRequest("user@test.com", "WEB", "1.2.3.4", "Agent"));

            assertThat(initResponse.state()).isEqualTo("PRIMARY_CHALLENGE");
            UUID txnId = initResponse.txnId();

            // 2. Submit password — build session as it would be after initiate
            AuthSessionData session = buildSession(AuthState.PRIMARY_CHALLENGE, true);
            session.setTxnId(txnId);
            mockRedisLoad(session);
            when(txnRepo.findByAuthTxnId(txnId)).thenReturn(Optional.of(buildTxn(session)));
            when(loginAttemptRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));

            PrimaryFactorResponse primaryResponse = service.submitPrimaryFactor(
                    new FactorSubmitRequest(txnId, "PASSWORD", Map.of("password", "pass123")));

            assertThat(primaryResponse.status()).isEqualTo("MFA_REQUIRED");
            assertThat(primaryResponse.mfaRequired()).isTrue();

            // 3. Submit TOTP
            AuthSessionData mfaSession = buildSession(AuthState.MFA_CHALLENGE, true);
            mfaSession.setTxnId(txnId);
            mockRedisLoad(mfaSession);
            when(resultRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));

            MfaFactorResponse mfaResponse = service.submitMfaFactor(
                    new FactorSubmitRequest(txnId, "TOTP", Map.of("code", "654321")));

            assertThat(mfaResponse.status()).isEqualTo("AUTHENTICATED");
            assertThat(mfaResponse.tokens()).isNotNull();
        }

        @Test
        void fidoPasswordlessFlow() {
            when(redisTemplate.opsForValue()).thenReturn(valueOperations);
            when(txnRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));

            AuthInitiateResponse initResponse = service.initiateAuth(
                    new AuthInitiateRequest("user@test.com", "WEB", null, null));

            // Submit FIDO as primary without MFA
            AuthSessionData session = buildSession(AuthState.PRIMARY_CHALLENGE, false);
            session.setTxnId(initResponse.txnId());
            mockRedisLoad(session);
            when(txnRepo.findByAuthTxnId(initResponse.txnId())).thenReturn(Optional.of(buildTxn(session)));
            when(loginAttemptRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));
            when(resultRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));

            PrimaryFactorResponse response = service.submitPrimaryFactor(
                    new FactorSubmitRequest(initResponse.txnId(), "FIDO",
                            Map.of("credentialId", "cred-1", "authenticatorData", "authData")));

            assertThat(response.status()).isEqualTo("AUTHENTICATED");
            assertThat(response.mfaRequired()).isFalse();
            assertThat(response.tokens()).isNotNull();
        }
    }

    // ---- Helpers ----

    private AuthSessionData buildSession(AuthState state, boolean mfaRequired) {
        AuthSessionData session = new AuthSessionData();
        session.setTxnId(UUID.randomUUID());
        session.setTenantId(tenantId);
        session.setLoginId("user@test.com");
        session.setCurrentState(state);
        session.setMfaRequired(mfaRequired);
        session.setMaxPrimaryAttempts(5);
        session.setMaxMfaAttempts(3);
        session.setStartedAt(Instant.now());
        session.setExpiresAt(Instant.now().plus(5, ChronoUnit.MINUTES));
        return session;
    }

    private AuthTransaction buildTxn(AuthSessionData session) {
        AuthTransaction txn = new AuthTransaction();
        txn.setAuthTxnId(session.getTxnId());
        txn.setTenantId(session.getTenantId());
        txn.setCorrelationId(UUID.randomUUID());
        txn.setCurrentState(session.getCurrentState());
        txn.setChannelType(io.innait.wiam.authorchestrator.entity.ChannelType.WEB);
        txn.setStartedAt(session.getStartedAt());
        txn.setExpiresAt(session.getExpiresAt());
        return txn;
    }

    private void mockRedisLoad(AuthSessionData session) {
        when(redisTemplate.opsForValue()).thenReturn(valueOperations);
        try {
            String json = objectMapper.writeValueAsString(session);
            when(valueOperations.get(RedisCacheKeys.authTxnKey(session.getTxnId()))).thenReturn(json);
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }
}
