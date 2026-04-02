package io.innait.wiam.adminbff.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import io.innait.wiam.adminbff.client.CredentialServiceClient;
import io.innait.wiam.adminbff.client.IdentityServiceClient;
import io.innait.wiam.adminbff.dto.OnboardingEnrollMfaRequest;
import io.innait.wiam.adminbff.dto.OnboardingSetPasswordRequest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;

import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class OnboardingServiceTest {

    @Mock private StringRedisTemplate redisTemplate;
    @Mock private ValueOperations<String, String> valueOps;
    @Mock private IdentityServiceClient identityClient;
    @Mock private CredentialServiceClient credentialClient;

    private OnboardingService service;
    private final ObjectMapper objectMapper = new ObjectMapper();

    private static final UUID ACCOUNT_ID = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        service = new OnboardingService(redisTemplate, identityClient, credentialClient, objectMapper);
        lenient().when(redisTemplate.opsForValue()).thenReturn(valueOps);
    }

    @Nested
    class AcceptTerms {

        @Test
        void shouldAcceptTermsAndAdvanceState() {
            when(valueOps.get(contains("onboarding:"))).thenReturn(null);

            Map<String, Object> result = service.acceptTerms(ACCOUNT_ID);

            assertThat(result).containsEntry("nextStep", "SET_PASSWORD");
            assertThat(result).containsEntry("currentStep", "TERMS_ACCEPTED");
            verify(valueOps).set(contains("onboarding:"), anyString(), any());
        }
    }

    @Nested
    class SetPassword {

        @Test
        void shouldRejectSetPasswordBeforeTerms() {
            when(valueOps.get(contains("onboarding:"))).thenReturn(null);

            assertThatThrownBy(() -> service.setPassword(ACCOUNT_ID,
                    new OnboardingSetPasswordRequest("NewPass123!")))
                    .isInstanceOf(IllegalStateException.class)
                    .hasMessageContaining("accept the terms");
        }

        @Test
        void shouldSetPasswordAndAdvanceState() throws Exception {
            OnboardingService.OnboardingState state = new OnboardingService.OnboardingState();
            state.step = OnboardingService.OnboardingStep.TERMS_ACCEPTED;
            state.termsAcceptedAt = "2026-04-02T10:00:00Z";
            state.passwordSet = false;
            state.mfaEnrolled = false;
            when(valueOps.get(contains("onboarding:"))).thenReturn(objectMapper.writeValueAsString(state));

            Map<String, Object> result = service.setPassword(ACCOUNT_ID,
                    new OnboardingSetPasswordRequest("SecurePass123!"));

            assertThat(result).containsEntry("nextStep", "ENROLL_MFA");
            assertThat(result).containsEntry("currentStep", "PASSWORD_SET");
            verify(credentialClient).enrollPassword(ACCOUNT_ID, "SecurePass123!");
        }
    }

    @Nested
    class EnrollMfa {

        @Test
        void shouldRejectMfaBeforePasswordSet() throws Exception {
            OnboardingService.OnboardingState state = new OnboardingService.OnboardingState();
            state.step = OnboardingService.OnboardingStep.TERMS_ACCEPTED;
            state.passwordSet = false;
            state.mfaEnrolled = false;
            when(valueOps.get(contains("onboarding:"))).thenReturn(objectMapper.writeValueAsString(state));

            assertThatThrownBy(() -> service.enrollMfa(ACCOUNT_ID,
                    new OnboardingEnrollMfaRequest("totp", "123456")))
                    .isInstanceOf(IllegalStateException.class)
                    .hasMessageContaining("set a password");
        }

        @Test
        void shouldEnrollTotpAndAdvanceState() throws Exception {
            OnboardingService.OnboardingState state = new OnboardingService.OnboardingState();
            state.step = OnboardingService.OnboardingStep.PASSWORD_SET;
            state.passwordSet = true;
            state.mfaEnrolled = false;
            when(valueOps.get(contains("onboarding:"))).thenReturn(objectMapper.writeValueAsString(state));
            when(credentialClient.confirmTotp(anyMap())).thenReturn(Map.of("verified", true));

            Map<String, Object> result = service.enrollMfa(ACCOUNT_ID,
                    new OnboardingEnrollMfaRequest("totp", "123456"));

            assertThat(result).containsEntry("nextStep", "COMPLETE");
            assertThat(result).containsEntry("currentStep", "MFA_ENROLLED");
        }
    }

    @Nested
    class CompleteOnboarding {

        @Test
        void shouldCompleteOnboardingAndActivateUser() throws Exception {
            OnboardingService.OnboardingState state = new OnboardingService.OnboardingState();
            state.step = OnboardingService.OnboardingStep.MFA_ENROLLED;
            state.passwordSet = true;
            state.mfaEnrolled = true;
            when(valueOps.get(contains("onboarding:"))).thenReturn(objectMapper.writeValueAsString(state));

            Map<String, Object> result = service.completeOnboarding(ACCOUNT_ID);

            assertThat(result).containsEntry("status", "COMPLETED");
            verify(identityClient).updateUserStatus(ACCOUNT_ID, "ACTIVE");
            verify(redisTemplate).delete(contains("onboarding:"));
        }

        @Test
        void shouldRejectCompleteIfStepsIncomplete() throws Exception {
            OnboardingService.OnboardingState state = new OnboardingService.OnboardingState();
            state.step = OnboardingService.OnboardingStep.PASSWORD_SET;
            state.passwordSet = true;
            state.mfaEnrolled = false;
            when(valueOps.get(contains("onboarding:"))).thenReturn(objectMapper.writeValueAsString(state));

            assertThatThrownBy(() -> service.completeOnboarding(ACCOUNT_ID))
                    .isInstanceOf(IllegalStateException.class)
                    .hasMessageContaining("All onboarding steps");
        }

        @Test
        void shouldRejectCompleteIfNoOnboardingInProgress() {
            when(valueOps.get(contains("onboarding:"))).thenReturn(null);

            assertThatThrownBy(() -> service.completeOnboarding(ACCOUNT_ID))
                    .isInstanceOf(IllegalStateException.class)
                    .hasMessageContaining("No onboarding in progress");
        }
    }
}
