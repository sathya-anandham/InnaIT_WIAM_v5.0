package io.innait.wiam.authorchestrator.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.innait.wiam.authorchestrator.dto.*;
import io.innait.wiam.authorchestrator.entity.*;
import io.innait.wiam.authorchestrator.repository.AuthChallengeRepository;
import io.innait.wiam.authorchestrator.repository.AuthResultRepository;
import io.innait.wiam.authorchestrator.repository.AuthTransactionRepository;
import io.innait.wiam.authorchestrator.repository.LoginAttemptRepository;
import io.innait.wiam.authorchestrator.statemachine.AuthEvent;
import io.innait.wiam.authorchestrator.statemachine.AuthState;
import io.innait.wiam.authorchestrator.statemachine.AuthStateMachine;
import io.innait.wiam.common.context.CorrelationContext;
import io.innait.wiam.common.context.TenantContext;
import io.innait.wiam.common.event.EventEnvelope;
import io.innait.wiam.common.exception.ResourceNotFoundException;
import io.innait.wiam.common.kafka.EventPublisher;
import io.innait.wiam.common.kafka.InnaITTopics;
import io.innait.wiam.common.redis.RedisCacheKeys;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.concurrent.TimeUnit;

@Service
public class AuthOrchestrationService {

    private static final Logger log = LoggerFactory.getLogger(AuthOrchestrationService.class);

    private final AuthStateMachine stateMachine;
    private final AuthTransactionRepository txnRepo;
    private final AuthChallengeRepository challengeRepo;
    private final AuthResultRepository resultRepo;
    private final LoginAttemptRepository loginAttemptRepo;
    private final StringRedisTemplate redisTemplate;
    private final EventPublisher eventPublisher;
    private final ObjectMapper objectMapper;

    @Value("${innait.auth.txn-ttl-seconds:300}")
    private long txnTtlSeconds;

    @Value("${innait.auth.max-primary-attempts:5}")
    private int defaultMaxPrimaryAttempts;

    @Value("${innait.auth.max-mfa-attempts:3}")
    private int defaultMaxMfaAttempts;

    @Value("${innait.auth.lockout-duration-minutes:30}")
    private int lockoutDurationMinutes;

    @Value("${innait.auth.mfa-required:true}")
    private boolean defaultMfaRequired;

    public AuthOrchestrationService(AuthStateMachine stateMachine,
                                     AuthTransactionRepository txnRepo,
                                     AuthChallengeRepository challengeRepo,
                                     AuthResultRepository resultRepo,
                                     LoginAttemptRepository loginAttemptRepo,
                                     StringRedisTemplate redisTemplate,
                                     EventPublisher eventPublisher,
                                     ObjectMapper objectMapper) {
        this.stateMachine = stateMachine;
        this.txnRepo = txnRepo;
        this.challengeRepo = challengeRepo;
        this.resultRepo = resultRepo;
        this.loginAttemptRepo = loginAttemptRepo;
        this.redisTemplate = redisTemplate;
        this.eventPublisher = eventPublisher;
        this.objectMapper = objectMapper;
    }

    // ---- Initiate Auth ----

    @Transactional
    public AuthInitiateResponse initiateAuth(AuthInitiateRequest request) {
        UUID tenantId = TenantContext.requireTenantId();
        UUID txnId = UUID.randomUUID();
        Instant now = Instant.now();
        Instant expiresAt = now.plus(txnTtlSeconds, ChronoUnit.SECONDS);

        ChannelType channelType = parseChannelType(request.channelType());

        // Determine available primary methods — check bootstrap eligibility first
        List<String> primaryMethods = determinePrimaryMethods(request.loginId(), tenantId);

        // Create AUTH_TRANSACTIONS record
        AuthTransaction txn = new AuthTransaction();
        txn.setAuthTxnId(txnId);
        txn.setTenantId(tenantId);
        txn.setCorrelationId(CorrelationContext.requireCorrelationId());
        txn.setCurrentState(AuthState.INITIATED);
        txn.setChannelType(channelType);
        txn.setClientIp(request.sourceIp());
        txn.setUserAgent(request.userAgent());
        txn.setExpiresAt(expiresAt);
        txnRepo.save(txn);

        // Cache auth state in Redis
        AuthSessionData session = new AuthSessionData();
        session.setTxnId(txnId);
        session.setTenantId(tenantId);
        session.setLoginId(request.loginId());
        session.setCurrentState(AuthState.INITIATED);
        session.setMfaRequired(defaultMfaRequired);
        session.setMaxPrimaryAttempts(defaultMaxPrimaryAttempts);
        session.setMaxMfaAttempts(defaultMaxMfaAttempts);
        session.setAvailablePrimaryMethods(primaryMethods);
        session.setBootstrapFlow(primaryMethods.contains("MAGIC_LINK"));
        session.setStartedAt(now);
        session.setExpiresAt(expiresAt);
        saveSession(session);

        // Transition to PRIMARY_CHALLENGE
        AuthState newState = stateMachine.transition(AuthState.INITIATED, AuthEvent.LOGIN_ID_SUBMITTED);
        session.setCurrentState(newState);
        saveSession(session);

        // Update Oracle
        txn.setCurrentState(newState);
        txnRepo.save(txn);

        // Publish auth.started event
        publishAuthEvent(InnaITTopics.AUTH_STARTED, "auth.started", txnId, tenantId,
                Map.of("loginId", request.loginId(), "channelType", channelType.name()));

        log.info("Auth initiated: txnId={}, loginId={}", txnId, request.loginId());
        return new AuthInitiateResponse(txnId, newState.name(), primaryMethods);
    }

    // ---- Submit Primary Factor ----

    @Transactional
    public PrimaryFactorResponse submitPrimaryFactor(FactorSubmitRequest request) {
        AuthSessionData session = loadSession(request.txnId());
        validateNotExpired(session);

        FactorType factorType = FactorType.valueOf(request.factorType().toUpperCase());

        // Verify primary factor by routing to credential service
        boolean verified = verifyPrimaryFactor(session, factorType, request.factorData());

        if (verified) {
            return handlePrimarySuccess(session, factorType);
        } else {
            return handlePrimaryFailure(session, factorType);
        }
    }

    // ---- Submit MFA Factor ----

    @Transactional
    public MfaFactorResponse submitMfaFactor(FactorSubmitRequest request) {
        AuthSessionData session = loadSession(request.txnId());
        validateNotExpired(session);

        if (session.getCurrentState() != AuthState.MFA_CHALLENGE) {
            throw new IllegalStateException("Transaction is not in MFA_CHALLENGE state: " + session.getCurrentState());
        }

        FactorType factorType = FactorType.valueOf(request.factorType().toUpperCase());

        boolean verified = verifyMfaFactor(session, factorType, request.factorData());

        if (verified) {
            return handleMfaSuccess(session, factorType);
        } else {
            return handleMfaFailure(session, factorType);
        }
    }

    // ---- Get Auth Status ----

    public AuthStatusResponse getAuthStatus(UUID txnId) {
        AuthSessionData session = loadSessionOrNull(txnId);
        if (session != null) {
            return new AuthStatusResponse(
                    session.getTxnId(),
                    session.getCurrentState().name(),
                    session.getStartedAt(),
                    session.getExpiresAt(),
                    null
            );
        }

        // Fallback to Oracle if Redis expired
        AuthTransaction txn = txnRepo.findByAuthTxnId(txnId)
                .orElseThrow(() -> new ResourceNotFoundException("AuthTransaction", txnId.toString()));
        return new AuthStatusResponse(
                txn.getAuthTxnId(),
                txn.getCurrentState().name(),
                txn.getStartedAt(),
                txn.getExpiresAt(),
                txn.getCompletedAt()
        );
    }

    // ---- Abort ----

    @Transactional
    public AuthStatusResponse abortAuth(UUID txnId) {
        AuthSessionData session = loadSession(txnId);

        if (stateMachine.isTerminal(session.getCurrentState())) {
            throw new IllegalStateException("Transaction already in terminal state: " + session.getCurrentState());
        }

        AuthState newState = stateMachine.transition(session.getCurrentState(), AuthEvent.AUTH_ABORTED);
        session.setCurrentState(newState);
        saveSession(session);

        // Update Oracle
        updateTransactionState(txnId, newState, Instant.now());

        // Create result record
        createAuthResult(txnId, session.getTenantId(), AuthResultType.CANCELLED,
                session.getAuthMethodsUsed(), "User aborted", null);

        log.info("Auth aborted: txnId={}", txnId);
        return new AuthStatusResponse(txnId, newState.name(), session.getStartedAt(),
                session.getExpiresAt(), Instant.now());
    }

    // ---- Magic Link Bootstrap Flow ----

    @Transactional
    public MagicLinkSendResponse sendMagicLink(MagicLinkSendRequest request) {
        AuthSessionData session = loadSession(request.txnId());
        validateNotExpired(session);

        if (session.getCurrentState() != AuthState.PRIMARY_CHALLENGE) {
            throw new IllegalStateException("Cannot send magic link in state: " + session.getCurrentState());
        }

        // Transition: PRIMARY_CHALLENGE → MAGIC_LINK_SENT
        AuthState newState = stateMachine.transition(session.getCurrentState(), AuthEvent.MAGIC_LINK_SENT);
        session.setCurrentState(newState);
        session.setAccountId(request.accountId());
        session.setBootstrapFlow(true);
        saveSession(session);

        updateTransactionState(session.getTxnId(), newState, null);

        // Delegate to credential-service to generate and send the magic link.
        // In production: REST call to credential-service MagicLinkBootstrapService.
        Instant magicLinkExpiresAt = Instant.now().plus(5, ChronoUnit.MINUTES);

        publishAuthEvent(InnaITTopics.MAGIC_LINK_SENT, "auth.magic_link.sent",
                session.getTxnId(), session.getTenantId(),
                Map.of("accountId", request.accountId().toString(),
                        "email", request.email() != null ? request.email() : ""));

        log.info("Magic link sent: txnId={}, accountId={}", session.getTxnId(), request.accountId());
        return new MagicLinkSendResponse(session.getTxnId(), newState.name(), magicLinkExpiresAt);
    }

    @Transactional
    public MagicLinkVerifyResponse verifyMagicLink(String token) {
        // Delegate to credential-service to verify the magic link token.
        // In production: REST call to credential-service MagicLinkBootstrapService.verifyMagicLink(token).
        UUID txnId = extractTxnIdFromToken(token);
        AuthSessionData session = loadSession(txnId);
        validateNotExpired(session);

        if (session.getCurrentState() != AuthState.MAGIC_LINK_SENT) {
            throw new IllegalStateException("Cannot verify magic link in state: " + session.getCurrentState());
        }

        // Transition: MAGIC_LINK_SENT → ONBOARDING_REQUIRED
        AuthState newState = stateMachine.transition(session.getCurrentState(), AuthEvent.MAGIC_LINK_VERIFIED);
        session.setCurrentState(newState);

        // Create restricted bootstrap session
        UUID bootstrapSessionId = UUID.randomUUID();
        session.setBootstrapSessionId(bootstrapSessionId);
        saveSession(session);

        updateTransactionState(session.getTxnId(), newState, null);

        // Store bootstrap session in Redis with limited TTL
        storeBootstrapSession(bootstrapSessionId, session);

        publishAuthEvent(InnaITTopics.MAGIC_LINK_VERIFIED, "auth.magic_link.verified",
                session.getTxnId(), session.getTenantId(),
                Map.of("accountId", session.getAccountId() != null ? session.getAccountId().toString() : "",
                        "bootstrapSessionId", bootstrapSessionId.toString()));

        log.info("Magic link verified: txnId={}, bootstrapSessionId={}", txnId, bootstrapSessionId);
        return new MagicLinkVerifyResponse(txnId, newState.name(), true, bootstrapSessionId, true);
    }

    public BootstrapSessionResponse validateBootstrapSession(BootstrapSessionValidateRequest request) {
        String key = RedisCacheKeys.bootstrapSessionKey(request.sessionId());
        String json = redisTemplate.opsForValue().get(key);

        if (json == null) {
            return new BootstrapSessionResponse(request.sessionId(), null, null, null, "BOOTSTRAP", false);
        }

        try {
            AuthSessionData session = objectMapper.readValue(json, AuthSessionData.class);
            return new BootstrapSessionResponse(
                    request.sessionId(),
                    session.getAccountId(),
                    session.getTenantId(),
                    null, // userId resolved from identity-service
                    "BOOTSTRAP",
                    true
            );
        } catch (JsonProcessingException e) {
            log.error("Failed to deserialize bootstrap session: {}", request.sessionId(), e);
            return new BootstrapSessionResponse(request.sessionId(), null, null, null, "BOOTSTRAP", false);
        }
    }

    @Transactional
    public BootstrapSessionResponse expireBootstrapSession(UUID sessionId) {
        String key = RedisCacheKeys.bootstrapSessionKey(sessionId);
        redisTemplate.delete(key);

        publishBootstrapDisabledEvent(sessionId);

        log.info("Bootstrap session expired: sessionId={}", sessionId);
        return new BootstrapSessionResponse(sessionId, null, null, null, "BOOTSTRAP", false);
    }

    // ---- Bootstrap: FIDO Enrollment Transitions ----

    @Transactional
    public AuthStatusResponse startFidoEnrollment(UUID txnId) {
        AuthSessionData session = loadSession(txnId);
        validateNotExpired(session);

        if (session.getCurrentState() != AuthState.ONBOARDING_REQUIRED) {
            throw new IllegalStateException("Cannot start FIDO enrollment in state: " + session.getCurrentState());
        }

        AuthState newState = stateMachine.transition(session.getCurrentState(), AuthEvent.FIDO_ENROLLMENT_STARTED);
        session.setCurrentState(newState);
        saveSession(session);
        updateTransactionState(txnId, newState, null);

        log.info("FIDO enrollment started: txnId={}", txnId);
        return new AuthStatusResponse(txnId, newState.name(), session.getStartedAt(),
                session.getExpiresAt(), null);
    }

    @Transactional
    public AuthStatusResponse completeFidoEnrollment(UUID txnId) {
        AuthSessionData session = loadSession(txnId);
        validateNotExpired(session);

        if (session.getCurrentState() != AuthState.FIDO_ENROLLMENT_IN_PROGRESS) {
            throw new IllegalStateException("Cannot complete FIDO enrollment in state: " + session.getCurrentState());
        }

        AuthState newState = stateMachine.transition(session.getCurrentState(), AuthEvent.FIDO_ENROLLMENT_COMPLETED);
        session.setCurrentState(newState);
        session.getAuthMethodsUsed().add(FactorType.FIDO.name());
        saveSession(session);
        updateTransactionState(txnId, newState, Instant.now());

        // Expire bootstrap session after successful FIDO enrollment
        if (session.getBootstrapSessionId() != null) {
            expireBootstrapSession(session.getBootstrapSessionId());
        }

        // Issue tokens for the now-authenticated user
        issueTokens(session);
        createAuthResult(txnId, session.getTenantId(), AuthResultType.SUCCESS,
                session.getAuthMethodsUsed(), null, null);

        publishAuthEvent(InnaITTopics.AUTH_SUCCEEDED, "auth.succeeded",
                txnId, session.getTenantId(),
                Map.of("accountId", session.getAccountId() != null ? session.getAccountId().toString() : "",
                        "methods", String.join(",", session.getAuthMethodsUsed()),
                        "bootstrapFlow", "true"));

        log.info("FIDO enrollment completed, auth complete: txnId={}", txnId);
        return new AuthStatusResponse(txnId, newState.name(), session.getStartedAt(),
                session.getExpiresAt(), Instant.now());
    }

    // ---- Step-Up Authentication ----

    @Transactional
    public AuthInitiateResponse initiateStepUp(StepUpInitiateRequest request) {
        TenantContext.requireTenantId();

        // Step-up creates a new auth transaction requiring re-authentication
        AuthInitiateRequest authRequest = new AuthInitiateRequest(
                "step-up:" + request.sessionId(),
                "WEB",
                null,
                null
        );

        AuthInitiateResponse response = initiateAuth(authRequest);
        log.info("Step-up auth initiated: txnId={}, sessionId={}", response.txnId(), request.sessionId());
        return response;
    }

    // ---- Internal: Primary Factor Handling ----

    private boolean verifyPrimaryFactor(AuthSessionData session, FactorType factorType,
                                         Map<String, String> factorData) {
        // Route to appropriate credential service based on factor type.
        // In production, these would be REST calls to innait-credential-service.
        // For now, we delegate to a pluggable verifier interface.
        return switch (factorType) {
            case PASSWORD -> verifyPassword(session, factorData);
            case FIDO -> verifyFido(session, factorData);
            default -> throw new IllegalArgumentException("Unsupported primary factor: " + factorType);
        };
    }

    private PrimaryFactorResponse handlePrimarySuccess(AuthSessionData session, FactorType factorType) {
        AuthState newState = stateMachine.transition(session.getCurrentState(),
                AuthEvent.PRIMARY_FACTOR_VERIFIED);
        session.setCurrentState(newState);
        session.getAuthMethodsUsed().add(factorType.name());
        session.setFailedPrimaryAttempts(0);

        recordLoginAttempt(session, AttemptStatus.SUCCESS, null);

        if (session.isMfaRequired()) {
            // Transition to MFA_CHALLENGE
            List<String> mfaMethods = determineMfaMethods();
            session.setAvailableMfaMethods(mfaMethods);

            AuthState mfaState = stateMachine.transition(newState, AuthEvent.MFA_CHALLENGE_ISSUED);
            session.setCurrentState(mfaState);
            saveSession(session);
            updateTransactionState(session.getTxnId(), mfaState, null);

            return new PrimaryFactorResponse(session.getTxnId(), mfaState.name(),
                    true, mfaMethods, null);
        } else {
            // No MFA required — complete authentication
            AuthState completedState = stateMachine.transition(newState, AuthEvent.AUTH_COMPLETED);
            session.setCurrentState(completedState);
            saveSession(session);
            updateTransactionState(session.getTxnId(), completedState, Instant.now());

            TokenSet tokens = issueTokens(session);
            createAuthResult(session.getTxnId(), session.getTenantId(), AuthResultType.SUCCESS,
                    session.getAuthMethodsUsed(), null, null);

            publishAuthEvent(InnaITTopics.AUTH_SUCCEEDED, "auth.succeeded",
                    session.getTxnId(), session.getTenantId(),
                    Map.of("accountId", session.getAccountId() != null ? session.getAccountId().toString() : "",
                            "methods", String.join(",", session.getAuthMethodsUsed())));

            return new PrimaryFactorResponse(session.getTxnId(), completedState.name(),
                    false, List.of(), tokens);
        }
    }

    private PrimaryFactorResponse handlePrimaryFailure(AuthSessionData session, FactorType factorType) {
        session.setFailedPrimaryAttempts(session.getFailedPrimaryAttempts() + 1);

        recordLoginAttempt(session, AttemptStatus.FAILURE, "Invalid " + factorType.name().toLowerCase());

        if (session.getFailedPrimaryAttempts() >= session.getMaxPrimaryAttempts()) {
            // Max retries exceeded → FAILED
            AuthState failedState = stateMachine.transition(session.getCurrentState(),
                    AuthEvent.PRIMARY_FACTOR_FAILED);
            session.setCurrentState(failedState);
            saveSession(session);
            updateTransactionState(session.getTxnId(), failedState, Instant.now());

            // Trigger account lockout
            lockAccount(session);

            createAuthResult(session.getTxnId(), session.getTenantId(), AuthResultType.FAILURE,
                    session.getAuthMethodsUsed(), "Max primary attempts exceeded", null);

            publishAuthEvent(InnaITTopics.AUTH_FAILED, "auth.failed",
                    session.getTxnId(), session.getTenantId(),
                    Map.of("reason", "lockout", "attempts", String.valueOf(session.getFailedPrimaryAttempts())));

            log.warn("Auth failed (lockout): txnId={}, attempts={}",
                    session.getTxnId(), session.getFailedPrimaryAttempts());
        } else {
            saveSession(session);
        }

        return new PrimaryFactorResponse(session.getTxnId(), session.getCurrentState().name(),
                false, List.of(), null);
    }

    // ---- Internal: MFA Factor Handling ----

    private boolean verifyMfaFactor(AuthSessionData session, FactorType factorType,
                                     Map<String, String> factorData) {
        return switch (factorType) {
            case TOTP -> verifyTotp(session, factorData);
            case FIDO -> verifyFido(session, factorData);
            case SOFTTOKEN -> verifySoftToken(session, factorData);
            case BACKUP_CODE -> verifyBackupCode(session, factorData);
            default -> throw new IllegalArgumentException("Unsupported MFA factor: " + factorType);
        };
    }

    private MfaFactorResponse handleMfaSuccess(AuthSessionData session, FactorType factorType) {
        AuthState mfaVerified = stateMachine.transition(session.getCurrentState(),
                AuthEvent.MFA_FACTOR_VERIFIED);
        session.setCurrentState(mfaVerified);
        session.getAuthMethodsUsed().add(factorType.name());

        AuthState completed = stateMachine.transition(mfaVerified, AuthEvent.AUTH_COMPLETED);
        session.setCurrentState(completed);
        saveSession(session);
        updateTransactionState(session.getTxnId(), completed, Instant.now());

        TokenSet tokens = issueTokens(session);
        createAuthResult(session.getTxnId(), session.getTenantId(), AuthResultType.SUCCESS,
                session.getAuthMethodsUsed(), null, null);

        publishAuthEvent(InnaITTopics.AUTH_SUCCEEDED, "auth.succeeded",
                session.getTxnId(), session.getTenantId(),
                Map.of("accountId", session.getAccountId() != null ? session.getAccountId().toString() : "",
                        "methods", String.join(",", session.getAuthMethodsUsed())));

        log.info("Auth completed: txnId={}", session.getTxnId());
        return new MfaFactorResponse(session.getTxnId(), completed.name(), tokens);
    }

    private MfaFactorResponse handleMfaFailure(AuthSessionData session, FactorType factorType) {
        session.setFailedMfaAttempts(session.getFailedMfaAttempts() + 1);

        if (session.getFailedMfaAttempts() >= session.getMaxMfaAttempts()) {
            AuthState failedState = stateMachine.transition(session.getCurrentState(),
                    AuthEvent.MFA_FACTOR_FAILED);
            session.setCurrentState(failedState);
            saveSession(session);
            updateTransactionState(session.getTxnId(), failedState, Instant.now());

            createAuthResult(session.getTxnId(), session.getTenantId(), AuthResultType.FAILURE,
                    session.getAuthMethodsUsed(), "Max MFA attempts exceeded", null);

            publishAuthEvent(InnaITTopics.AUTH_FAILED, "auth.failed",
                    session.getTxnId(), session.getTenantId(),
                    Map.of("reason", "mfa_lockout", "attempts", String.valueOf(session.getFailedMfaAttempts())));
        } else {
            saveSession(session);
        }

        return new MfaFactorResponse(session.getTxnId(), session.getCurrentState().name(), null);
    }

    // ---- Credential Verification Delegates ----
    // In production, these call innait-credential-service via REST/gRPC.
    // Here they validate factorData keys and delegate to injected verifiers.

    private boolean verifyPassword(AuthSessionData session, Map<String, String> factorData) {
        String password = factorData != null ? factorData.get("password") : null;
        if (password == null || password.isBlank()) {
            return false;
        }
        // Delegate to credential service: credentialService.verifyPassword(accountId, password)
        // For now, return true if password is provided (placeholder for inter-service call)
        log.debug("Password verification delegated for loginId={}", session.getLoginId());
        return true;
    }

    private boolean verifyFido(AuthSessionData session, Map<String, String> factorData) {
        String credentialId = factorData != null ? factorData.get("credentialId") : null;
        String authenticatorData = factorData != null ? factorData.get("authenticatorData") : null;
        if (credentialId == null || authenticatorData == null) {
            return false;
        }
        log.debug("FIDO verification delegated for loginId={}", session.getLoginId());
        return true;
    }

    private boolean verifyTotp(AuthSessionData session, Map<String, String> factorData) {
        String code = factorData != null ? factorData.get("code") : null;
        if (code == null || code.isBlank()) {
            return false;
        }
        log.debug("TOTP verification delegated for loginId={}", session.getLoginId());
        return true;
    }

    private boolean verifySoftToken(AuthSessionData session, Map<String, String> factorData) {
        String challengeId = factorData != null ? factorData.get("challengeId") : null;
        String signedResponse = factorData != null ? factorData.get("signedResponse") : null;
        if (challengeId == null || signedResponse == null) {
            return false;
        }
        log.debug("SoftToken verification delegated for loginId={}", session.getLoginId());
        return true;
    }

    private boolean verifyBackupCode(AuthSessionData session, Map<String, String> factorData) {
        String code = factorData != null ? factorData.get("code") : null;
        if (code == null || code.isBlank()) {
            return false;
        }
        log.debug("Backup code verification delegated for loginId={}", session.getLoginId());
        return true;
    }

    // ---- Account Lockout ----

    private void lockAccount(AuthSessionData session) {
        if (session.getAccountId() == null) {
            return;
        }
        // In production: call identity service to set account status=LOCKED,
        // LOCKED_UNTIL = now + lockoutDurationMinutes
        // Also publish account.status.changed event
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("accountId", session.getAccountId().toString());
        payload.put("reason", "excessive_failed_auth_attempts");
        payload.put("lockoutDurationMinutes", lockoutDurationMinutes);

        EventEnvelope<Map<String, Object>> event = EventEnvelope.<Map<String, Object>>builder()
                .eventType("account.status.changed")
                .tenantId(session.getTenantId())
                .correlationId(CorrelationContext.getCorrelationId())
                .payload(payload)
                .build();
        eventPublisher.publish(InnaITTopics.ACCOUNT_STATUS_CHANGED, event);

        log.warn("Account locked due to excessive failed attempts: accountId={}", session.getAccountId());
    }

    // ---- Token Issuance ----

    private TokenSet issueTokens(AuthSessionData session) {
        // In production: call Token Service to issue JWT
        // Placeholder returning stub tokens
        return new TokenSet(
                "access-token-" + session.getTxnId(),
                "refresh-token-" + session.getTxnId(),
                3600
        );
    }

    // ---- Policy Resolution ----

    private List<String> determinePrimaryMethods(String loginId, UUID tenantId) {
        // Check if the account is bootstrap-eligible:
        // 1. Account has no enrolled FIDO credential
        // 2. Bootstrap is enabled for the account
        // 3. An assigned FIDO device exists
        // In production: these checks call credential-service via REST.
        if (isBootstrapEligible(loginId, tenantId)) {
            return List.of("MAGIC_LINK");
        }
        // Default: standard authentication methods from policy service
        return List.of("PASSWORD", "FIDO");
    }

    private boolean isBootstrapEligible(String loginId, UUID tenantId) {
        // Delegate to credential-service to check bootstrap eligibility.
        // In production: REST call to credential-service:
        //   GET /api/v1/device-registry/bootstrap-eligible?loginId={loginId}&tenantId={tenantId}
        // which checks:
        //   1. AccountBootstrapState.bootstrapEnabled = true AND firstLoginPending = true AND fidoEnrolled = false
        //   2. Active device assignment exists for the account
        //   3. No active FIDO credentials enrolled for the account
        // For now, delegate to Redis-cached bootstrap state if available.
        try {
            String bootstrapKey = RedisCacheKeys.MAGIC_LINK_PREFIX + ":eligible:" + tenantId + ":" + loginId;
            String cached = redisTemplate.opsForValue().get(bootstrapKey);
            if (cached != null) {
                return "true".equals(cached);
            }
        } catch (Exception e) {
            log.debug("Bootstrap eligibility check failed for loginId={}: {}", loginId, e.getMessage());
        }
        return false;
    }

    private List<String> determineMfaMethods() {
        return List.of("TOTP", "FIDO", "SOFTTOKEN", "BACKUP_CODE");
    }

    // ---- Redis Session Management ----

    void saveSession(AuthSessionData session) {
        try {
            String json = objectMapper.writeValueAsString(session);
            String key = RedisCacheKeys.authTxnKey(session.getTxnId());
            redisTemplate.opsForValue().set(key, json, txnTtlSeconds, TimeUnit.SECONDS);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Failed to serialize auth session", e);
        }
    }

    AuthSessionData loadSession(UUID txnId) {
        AuthSessionData session = loadSessionOrNull(txnId);
        if (session == null) {
            throw new ResourceNotFoundException("AuthSession", txnId.toString());
        }
        return session;
    }

    AuthSessionData loadSessionOrNull(UUID txnId) {
        String key = RedisCacheKeys.authTxnKey(txnId);
        String json = redisTemplate.opsForValue().get(key);
        if (json == null) {
            return null;
        }
        try {
            return objectMapper.readValue(json, AuthSessionData.class);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Failed to deserialize auth session", e);
        }
    }

    // ---- Oracle Persistence ----

    private void updateTransactionState(UUID txnId, AuthState newState, Instant completedAt) {
        txnRepo.findByAuthTxnId(txnId).ifPresent(txn -> {
            txn.setCurrentState(newState);
            if (completedAt != null) {
                txn.setCompletedAt(completedAt);
            }
            txnRepo.save(txn);
        });
    }

    private void createAuthResult(UUID txnId, UUID tenantId, AuthResultType resultType,
                                   List<String> authMethodsUsed, String failureReason, UUID sessionId) {
        AuthResult result = new AuthResult();
        result.setAuthTxnId(txnId);
        result.setTenantId(tenantId);
        result.setResult(resultType);
        result.setAuthMethodsUsed(authMethodsUsed != null ? authMethodsUsed.toString() : "[]");
        result.setFailureReason(failureReason);
        result.setSessionId(sessionId);
        resultRepo.save(result);
    }

    private void recordLoginAttempt(AuthSessionData session, AttemptStatus status, String failureReason) {
        LoginAttempt attempt = new LoginAttempt();
        attempt.setTenantId(session.getTenantId());
        attempt.setAccountId(session.getAccountId());
        attempt.setLoginId(session.getLoginId());
        attempt.setClientIp("unknown"); // In production, extract from session/request context
        attempt.setAttemptStatus(status);
        attempt.setFailureReason(failureReason);
        loginAttemptRepo.save(attempt);
    }

    // ---- Validation ----

    private void validateNotExpired(AuthSessionData session) {
        if (Instant.now().isAfter(session.getExpiresAt())) {
            // Transition to ABORTED on timeout
            if (!stateMachine.isTerminal(session.getCurrentState())) {
                AuthState aborted = stateMachine.transition(session.getCurrentState(), AuthEvent.TIMEOUT);
                session.setCurrentState(aborted);
                saveSession(session);
                updateTransactionState(session.getTxnId(), aborted, Instant.now());
            }
            throw new IllegalStateException("Auth transaction has expired: " + session.getTxnId());
        }
    }

    private ChannelType parseChannelType(String channelType) {
        if (channelType == null || channelType.isBlank()) {
            return ChannelType.WEB;
        }
        try {
            return ChannelType.valueOf(channelType.toUpperCase());
        } catch (IllegalArgumentException e) {
            return ChannelType.WEB;
        }
    }

    // ---- Bootstrap Session Management ----

    private void storeBootstrapSession(UUID bootstrapSessionId, AuthSessionData session) {
        try {
            String json = objectMapper.writeValueAsString(session);
            String key = RedisCacheKeys.bootstrapSessionKey(bootstrapSessionId);
            redisTemplate.opsForValue().set(key, json, RedisCacheKeys.BOOTSTRAP_SESSION_TTL, TimeUnit.SECONDS);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Failed to serialize bootstrap session", e);
        }
    }

    private UUID extractTxnIdFromToken(String token) {
        // In production: decode the magic link token which contains encrypted metadata
        // including txnId. The token is generated by credential-service.
        // For now, the token encodes the txnId directly (placeholder for inter-service call).
        try {
            return UUID.fromString(token);
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("Invalid magic link token");
        }
    }

    // ---- Event Publishing ----

    private void publishAuthEvent(String topic, String eventType, UUID txnId, UUID tenantId,
                                   Map<String, String> extraPayload) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("txnId", txnId.toString());
        payload.putAll(extraPayload);

        EventEnvelope<Map<String, Object>> event = EventEnvelope.<Map<String, Object>>builder()
                .eventType(eventType)
                .tenantId(tenantId)
                .correlationId(CorrelationContext.getCorrelationId())
                .payload(payload)
                .build();
        eventPublisher.publish(topic, event);
    }

    private void publishBootstrapDisabledEvent(UUID sessionId) {
        EventEnvelope<Map<String, Object>> event = EventEnvelope.<Map<String, Object>>builder()
                .eventType("auth.bootstrap.disabled")
                .tenantId(TenantContext.getTenantId())
                .correlationId(CorrelationContext.getCorrelationId())
                .payload(Map.of("bootstrapSessionId", sessionId.toString()))
                .build();
        eventPublisher.publish(InnaITTopics.BOOTSTRAP_DISABLED, event);
    }
}
