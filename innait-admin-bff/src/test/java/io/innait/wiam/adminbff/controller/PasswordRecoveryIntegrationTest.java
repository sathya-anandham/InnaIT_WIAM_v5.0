package io.innait.wiam.adminbff.controller;

import io.innait.wiam.adminbff.client.*;
import io.innait.wiam.common.security.InnaITAuthenticationToken;
import io.innait.wiam.common.security.JwtAuthenticationFilter;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.bean.MockBean;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;
import org.springframework.http.MediaType;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.hamcrest.Matchers.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class PasswordRecoveryIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean private JwtAuthenticationFilter jwtAuthenticationFilter;
    @MockBean private StringRedisTemplate stringRedisTemplate;
    @MockBean private IdentityServiceClient identityClient;
    @MockBean private SessionServiceClient sessionClient;
    @MockBean private AuditServiceClient auditClient;
    @MockBean private CredentialServiceClient credentialClient;
    @MockBean private AuthServiceClient authServiceClient;
    @MockBean private NotificationServiceClient notificationClient;
    @MockBean private TokenServiceClient tokenClient;

    private static final UUID USER_ID = UUID.randomUUID();
    private static final UUID TENANT_ID = UUID.randomUUID();
    private static final UUID SESSION_ID = UUID.randomUUID();

    @SuppressWarnings("unchecked")
    private ValueOperations<String, String> mockValueOps() {
        ValueOperations<String, String> valueOps = mock(ValueOperations.class);
        when(stringRedisTemplate.opsForValue()).thenReturn(valueOps);
        return valueOps;
    }

    private InnaITAuthenticationToken userAuth() {
        return new InnaITAuthenticationToken(
                "user@test.com", TENANT_ID, USER_ID, "user@test.com", SESSION_ID,
                List.of("USER"), List.of(), List.of("pwd"), "urn:innait:acr:pwd",
                "mock-jwt-token",
                List.of(new SimpleGrantedAuthority("ROLE_USER"))
        );
    }

    @Nested
    class ForgotPasswordFlow {

        @Test
        void shouldAcceptForgotPasswordWithoutAuthentication() throws Exception {
            ValueOperations<String, String> valueOps = mockValueOps();
            when(valueOps.get(contains("ratelimit:forgot"))).thenReturn(null);
            when(valueOps.increment(anyString())).thenReturn(1L);
            when(identityClient.lookupByEmail("user@test.com")).thenReturn(
                    Map.of("userId", USER_ID.toString(), "tenantId", TENANT_ID.toString()));

            mockMvc.perform(post("/api/v1/self/credentials/password/forgot")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"email\":\"user@test.com\"}"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.status").value("SUCCESS"))
                    .andExpect(jsonPath("$.data.message").value(containsString("If an account exists")));
        }

        @Test
        void shouldReturnSameResponseForNonExistentEmail() throws Exception {
            ValueOperations<String, String> valueOps = mockValueOps();
            when(valueOps.get(contains("ratelimit:forgot"))).thenReturn(null);
            when(valueOps.increment(anyString())).thenReturn(1L);
            when(identityClient.lookupByEmail("nobody@test.com")).thenReturn(null);

            mockMvc.perform(post("/api/v1/self/credentials/password/forgot")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"email\":\"nobody@test.com\"}"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.data.message").value(containsString("If an account exists")));

            verify(notificationClient, never()).sendEmail(any(), anyString(), anyString(), anyMap());
        }

        @Test
        void shouldVerifyOtpAndReturnResetToken() throws Exception {
            ValueOperations<String, String> valueOps = mockValueOps();
            when(identityClient.lookupByEmail("user@test.com")).thenReturn(
                    Map.of("userId", USER_ID.toString(), "tenantId", TENANT_ID.toString()));
            when(valueOps.get(contains("otp:password_reset:"))).thenReturn("654321:user@test.com");

            mockMvc.perform(post("/api/v1/self/credentials/password/verify-otp")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"email\":\"user@test.com\",\"otp\":\"654321\"}"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.data.resetToken").isNotEmpty());
        }

        @Test
        void shouldResetPasswordWithValidToken() throws Exception {
            ValueOperations<String, String> valueOps = mockValueOps();
            String resetToken = UUID.randomUUID().toString();
            when(valueOps.get("reset:" + resetToken)).thenReturn(USER_ID + ":user@test.com");
            when(identityClient.lookupByEmail("user@test.com")).thenReturn(
                    Map.of("userId", USER_ID.toString(), "tenantId", TENANT_ID.toString()));

            mockMvc.perform(post("/api/v1/self/credentials/password/reset")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"resetToken\":\"" + resetToken + "\",\"newPassword\":\"NewSecure123!\"}"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.data.message").value(containsString("reset successfully")));

            verify(credentialClient).resetPassword(eq(USER_ID), eq("NewSecure123!"), any());
            verify(sessionClient).revokeAllAccountSessions(USER_ID);
        }
    }

    @Nested
    class AccountRecovery {

        @Test
        void shouldRecoverWithValidBackupCode() throws Exception {
            when(identityClient.lookupByLoginId("john@test.com")).thenReturn(
                    Map.of("userId", USER_ID.toString(), "tenantId", TENANT_ID.toString()));
            when(identityClient.getUserAccounts(USER_ID)).thenReturn(
                    List.of(Map.of("accountId", USER_ID.toString())));
            when(credentialClient.verifyBackupCode(USER_ID, "ABCD1234")).thenReturn(true);
            when(sessionClient.createSession(any())).thenReturn(
                    Map.of("sessionId", SESSION_ID.toString()));
            when(tokenClient.issueToken(any(), any(), any(), anyString(), anyList(), anyList(), anyString()))
                    .thenReturn(Map.of("accessToken", "recovery-access-token"));

            mockMvc.perform(post("/api/v1/self/recovery")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"loginId\":\"john@test.com\",\"backupCode\":\"ABCD1234\"}"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.data.accessToken").value("recovery-access-token"))
                    .andExpect(jsonPath("$.data.reducedAccess").value(true))
                    .andExpect(jsonPath("$.data.sessionId").value(SESSION_ID.toString()));
        }

        @Test
        void shouldRejectInvalidBackupCode() throws Exception {
            when(identityClient.lookupByLoginId("john@test.com")).thenReturn(
                    Map.of("userId", USER_ID.toString(), "tenantId", TENANT_ID.toString()));
            when(identityClient.getUserAccounts(USER_ID)).thenReturn(
                    List.of(Map.of("accountId", USER_ID.toString())));
            when(credentialClient.verifyBackupCode(USER_ID, "WRONGCODE")).thenReturn(false);

            mockMvc.perform(post("/api/v1/self/recovery")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"loginId\":\"john@test.com\",\"backupCode\":\"WRONGCODE\"}"))
                    .andExpect(status().isUnauthorized());
        }
    }

    @Nested
    class OnboardingFlow {

        @Test
        void shouldAcceptTermsWhenAuthenticated() throws Exception {
            ValueOperations<String, String> valueOps = mockValueOps();
            when(valueOps.get(contains("onboarding:"))).thenReturn(null);

            mockMvc.perform(post("/api/v1/self/onboarding/accept-terms")
                            .with(authentication(userAuth()))
                            .with(csrf()))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.data.nextStep").value("SET_PASSWORD"))
                    .andExpect(jsonPath("$.data.currentStep").value("TERMS_ACCEPTED"));
        }

        @Test
        void shouldRejectOnboardingWithoutAuthentication() throws Exception {
            mockMvc.perform(post("/api/v1/self/onboarding/accept-terms")
                            .with(csrf())
                            .contentType(MediaType.APPLICATION_JSON))
                    .andExpect(status().isUnauthorized());
        }

        @Test
        void shouldCompleteFullOnboardingWizard() throws Exception {
            ValueOperations<String, String> valueOps = mockValueOps();

            // Step 1: Accept terms (no prior state)
            when(valueOps.get(contains("onboarding:"))).thenReturn(null);
            mockMvc.perform(post("/api/v1/self/onboarding/accept-terms")
                            .with(authentication(userAuth()))
                            .with(csrf()))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.data.currentStep").value("TERMS_ACCEPTED"));

            // Step 2: Set password (state = TERMS_ACCEPTED)
            String termsAcceptedState = "{\"step\":\"TERMS_ACCEPTED\",\"termsAcceptedAt\":\"2026-04-02T10:00:00Z\",\"passwordSet\":false,\"mfaEnrolled\":false}";
            when(valueOps.get(contains("onboarding:"))).thenReturn(termsAcceptedState);
            mockMvc.perform(post("/api/v1/self/onboarding/set-password")
                            .with(authentication(userAuth()))
                            .with(csrf())
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"newPassword\":\"SecurePass123!\"}"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.data.currentStep").value("PASSWORD_SET"));

            // Step 3: Enroll MFA (state = PASSWORD_SET)
            String passwordSetState = "{\"step\":\"PASSWORD_SET\",\"termsAcceptedAt\":\"2026-04-02T10:00:00Z\",\"passwordSet\":true,\"mfaEnrolled\":false}";
            when(valueOps.get(contains("onboarding:"))).thenReturn(passwordSetState);
            when(credentialClient.confirmTotp(anyMap())).thenReturn(Map.of("verified", true));
            mockMvc.perform(post("/api/v1/self/onboarding/enroll-mfa")
                            .with(authentication(userAuth()))
                            .with(csrf())
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"mfaType\":\"totp\",\"verificationCode\":\"123456\"}"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.data.currentStep").value("MFA_ENROLLED"));

            // Step 4: Complete (state = MFA_ENROLLED)
            String mfaEnrolledState = "{\"step\":\"MFA_ENROLLED\",\"termsAcceptedAt\":\"2026-04-02T10:00:00Z\",\"passwordSet\":true,\"mfaEnrolled\":true}";
            when(valueOps.get(contains("onboarding:"))).thenReturn(mfaEnrolledState);
            mockMvc.perform(post("/api/v1/self/onboarding/complete")
                            .with(authentication(userAuth()))
                            .with(csrf()))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.data.status").value("COMPLETED"));

            verify(identityClient).updateUserStatus(USER_ID, "ACTIVE");
        }
    }
}
