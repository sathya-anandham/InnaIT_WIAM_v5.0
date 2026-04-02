package io.innait.wiam.adminbff.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.innait.wiam.adminbff.client.CredentialServiceClient;
import io.innait.wiam.adminbff.client.IdentityServiceClient;
import io.innait.wiam.adminbff.dto.OnboardingEnrollMfaRequest;
import io.innait.wiam.adminbff.dto.OnboardingSetPasswordRequest;
import io.innait.wiam.common.redis.RedisCacheKeys;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;

@Service
public class OnboardingService {

    private static final Logger log = LoggerFactory.getLogger(OnboardingService.class);

    private final StringRedisTemplate redisTemplate;
    private final IdentityServiceClient identityClient;
    private final CredentialServiceClient credentialClient;
    private final ObjectMapper objectMapper;

    public OnboardingService(StringRedisTemplate redisTemplate,
                              IdentityServiceClient identityClient,
                              CredentialServiceClient credentialClient,
                              ObjectMapper objectMapper) {
        this.redisTemplate = redisTemplate;
        this.identityClient = identityClient;
        this.credentialClient = credentialClient;
        this.objectMapper = objectMapper;
    }

    public Map<String, Object> acceptTerms(UUID accountId) {
        OnboardingState state = getOrCreateState(accountId);

        if (state.step != OnboardingStep.TERMS_PENDING) {
            // Allow re-acceptance but don't go backwards
            if (state.step.ordinal() > OnboardingStep.TERMS_ACCEPTED.ordinal()) {
                return Map.of("currentStep", state.step.name(), "message", "Terms already accepted.");
            }
        }

        state.step = OnboardingStep.TERMS_ACCEPTED;
        state.termsAcceptedAt = Instant.now().toString();
        saveState(accountId, state);

        log.info("Terms accepted for account [{}]", accountId);
        return Map.of("nextStep", "SET_PASSWORD", "currentStep", "TERMS_ACCEPTED");
    }

    public Map<String, Object> setPassword(UUID accountId, OnboardingSetPasswordRequest request) {
        OnboardingState state = getState(accountId);
        if (state == null || state.step.ordinal() < OnboardingStep.TERMS_ACCEPTED.ordinal()) {
            throw new IllegalStateException("You must accept the terms of service before setting a password.");
        }

        // Enroll password via credential service
        credentialClient.enrollPassword(accountId, request.newPassword());

        state.step = OnboardingStep.PASSWORD_SET;
        state.passwordSet = true;
        saveState(accountId, state);

        log.info("Password set during onboarding for account [{}]", accountId);
        return Map.of("nextStep", "ENROLL_MFA", "currentStep", "PASSWORD_SET");
    }

    public Map<String, Object> enrollMfa(UUID accountId, OnboardingEnrollMfaRequest request) {
        OnboardingState state = getState(accountId);
        if (state == null || state.step.ordinal() < OnboardingStep.PASSWORD_SET.ordinal()) {
            throw new IllegalStateException("You must set a password before enrolling MFA.");
        }

        Map<String, Object> result;
        switch (request.mfaType().toLowerCase()) {
            case "totp" -> {
                if (request.verificationCode() != null && !request.verificationCode().isBlank()) {
                    // Confirm TOTP enrollment with verification code
                    result = credentialClient.confirmTotp(Map.of(
                            "accountId", accountId.toString(),
                            "code", request.verificationCode()));
                } else {
                    // Begin TOTP enrollment — returns QR code URI
                    result = credentialClient.enrollTotp(Map.of("accountId", accountId.toString()));
                    return Map.of(
                            "currentStep", "ENROLL_MFA",
                            "mfaType", "totp",
                            "enrollmentData", result != null ? result : Map.of()
                    );
                }
            }
            case "fido" -> {
                if (request.verificationCode() != null && !request.verificationCode().isBlank()) {
                    // Complete FIDO registration
                    result = credentialClient.registerFidoComplete(Map.of(
                            "accountId", accountId.toString(),
                            "attestation", request.verificationCode()));
                } else {
                    // Begin FIDO registration
                    result = credentialClient.registerFidoBegin(Map.of("accountId", accountId.toString()));
                    return Map.of(
                            "currentStep", "ENROLL_MFA",
                            "mfaType", "fido",
                            "enrollmentData", result != null ? result : Map.of()
                    );
                }
            }
            default -> throw new IllegalArgumentException("Unsupported MFA type: " + request.mfaType());
        }

        state.step = OnboardingStep.MFA_ENROLLED;
        state.mfaEnrolled = true;
        saveState(accountId, state);

        log.info("MFA enrolled during onboarding for account [{}], type [{}]", accountId, request.mfaType());
        return Map.of("nextStep", "COMPLETE", "currentStep", "MFA_ENROLLED");
    }

    public Map<String, Object> completeOnboarding(UUID accountId) {
        OnboardingState state = getState(accountId);
        if (state == null) {
            throw new IllegalStateException("No onboarding in progress.");
        }
        if (!state.passwordSet || !state.mfaEnrolled) {
            throw new IllegalStateException("All onboarding steps must be completed before finishing.");
        }

        // Activate user via identity service
        identityClient.updateUserStatus(accountId, "ACTIVE");

        // Clean up onboarding state
        String key = RedisCacheKeys.onboardingKey(accountId);
        redisTemplate.delete(key);

        log.info("Onboarding completed for account [{}]", accountId);
        return Map.of("status", "COMPLETED", "message", "Onboarding completed successfully.");
    }

    public Map<String, Object> getOnboardingStatus(UUID accountId) {
        OnboardingState state = getState(accountId);
        if (state == null) {
            return Map.of("onboarding", false);
        }
        return Map.of(
                "onboarding", true,
                "currentStep", state.step.name(),
                "termsAccepted", state.termsAcceptedAt != null,
                "passwordSet", state.passwordSet,
                "mfaEnrolled", state.mfaEnrolled
        );
    }

    // ---- State management ----

    OnboardingState getOrCreateState(UUID accountId) {
        OnboardingState state = getState(accountId);
        if (state == null) {
            state = new OnboardingState();
            state.step = OnboardingStep.TERMS_PENDING;
            state.passwordSet = false;
            state.mfaEnrolled = false;
        }
        return state;
    }

    OnboardingState getState(UUID accountId) {
        String key = RedisCacheKeys.onboardingKey(accountId);
        String json = redisTemplate.opsForValue().get(key);
        if (json == null) return null;
        try {
            return objectMapper.readValue(json, OnboardingState.class);
        } catch (JsonProcessingException e) {
            log.warn("Failed to parse onboarding state for account [{}]: {}", accountId, e.getMessage());
            return null;
        }
    }

    void saveState(UUID accountId, OnboardingState state) {
        String key = RedisCacheKeys.onboardingKey(accountId);
        try {
            String json = objectMapper.writeValueAsString(state);
            redisTemplate.opsForValue().set(key, json, Duration.ofSeconds(RedisCacheKeys.ONBOARDING_TTL));
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Failed to serialize onboarding state", e);
        }
    }

    // ---- Inner types ----

    enum OnboardingStep {
        TERMS_PENDING,
        TERMS_ACCEPTED,
        PASSWORD_SET,
        MFA_ENROLLED,
        COMPLETED
    }

    static class OnboardingState {
        public OnboardingStep step;
        public String termsAcceptedAt;
        public boolean passwordSet;
        public boolean mfaEnrolled;
    }
}
