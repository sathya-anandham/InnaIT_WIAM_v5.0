package io.innait.wiam.adminbff.service;

import io.innait.wiam.adminbff.client.CredentialServiceClient;
import io.innait.wiam.adminbff.client.IdentityServiceClient;
import io.innait.wiam.adminbff.client.NotificationServiceClient;
import io.innait.wiam.adminbff.client.SessionServiceClient;
import io.innait.wiam.adminbff.dto.ForgotPasswordRequest;
import io.innait.wiam.adminbff.dto.ResetPasswordRequest;
import io.innait.wiam.adminbff.dto.VerifyOtpRequest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ForgotPasswordServiceTest {

    @Mock private StringRedisTemplate redisTemplate;
    @Mock private ValueOperations<String, String> valueOps;
    @Mock private IdentityServiceClient identityClient;
    @Mock private CredentialServiceClient credentialClient;
    @Mock private NotificationServiceClient notificationClient;
    @Mock private SessionServiceClient sessionClient;

    private ForgotPasswordService service;

    private static final UUID USER_ID = UUID.randomUUID();
    private static final UUID TENANT_ID = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        service = new ForgotPasswordService(redisTemplate, identityClient,
                credentialClient, notificationClient, sessionClient);
        ReflectionTestUtils.setField(service, "otpLength", 6);
        ReflectionTestUtils.setField(service, "otpTtlSeconds", 300L);
        ReflectionTestUtils.setField(service, "resetTokenTtlSeconds", 900L);
        ReflectionTestUtils.setField(service, "maxForgotAttempts", 3);
        ReflectionTestUtils.setField(service, "forgotRateWindowSeconds", 900L);
        lenient().when(redisTemplate.opsForValue()).thenReturn(valueOps);
    }

    @Nested
    class InitiateForgotPassword {

        @Test
        void shouldAlwaysReturnSameResponseRegardlessOfEmailExistence() {
            // User exists
            when(valueOps.get(contains("ratelimit:forgot"))).thenReturn(null);
            when(valueOps.increment(anyString())).thenReturn(1L);
            when(identityClient.lookupByEmail("exists@test.com")).thenReturn(
                    Map.of("userId", USER_ID.toString(), "tenantId", TENANT_ID.toString()));

            Map<String, String> resultExists = service.initiateForgotPassword(
                    new ForgotPasswordRequest("exists@test.com"));

            // User does not exist
            when(identityClient.lookupByEmail("missing@test.com")).thenReturn(null);

            Map<String, String> resultMissing = service.initiateForgotPassword(
                    new ForgotPasswordRequest("missing@test.com"));

            // Both should return identical messages
            assertThat(resultExists.get("message")).isEqualTo(resultMissing.get("message"));
            assertThat(resultExists.get("message")).contains("If an account exists");
        }

        @Test
        void shouldGenerateAndStoreOtpInRedis() {
            when(valueOps.get(contains("ratelimit:forgot"))).thenReturn(null);
            when(valueOps.increment(anyString())).thenReturn(1L);
            when(identityClient.lookupByEmail("user@test.com")).thenReturn(
                    Map.of("userId", USER_ID.toString(), "tenantId", TENANT_ID.toString()));

            service.initiateForgotPassword(new ForgotPasswordRequest("user@test.com"));

            // Verify OTP stored in Redis
            verify(valueOps).set(contains("otp:password_reset:"), anyString(), any());
            // Verify notification sent
            verify(notificationClient).sendEmail(eq(TENANT_ID), eq("user@test.com"),
                    eq("password_reset_otp"), anyMap());
        }

        @Test
        void shouldRateLimitForgotPasswordRequests() {
            when(valueOps.get(contains("ratelimit:forgot"))).thenReturn("3");

            assertThatThrownBy(() -> service.initiateForgotPassword(
                    new ForgotPasswordRequest("user@test.com")))
                    .isInstanceOf(IllegalStateException.class)
                    .hasMessageContaining("Too many");
        }

        @Test
        void shouldNotSendNotificationForNonExistentEmail() {
            when(valueOps.get(contains("ratelimit:forgot"))).thenReturn(null);
            when(valueOps.increment(anyString())).thenReturn(1L);
            when(identityClient.lookupByEmail("nobody@test.com")).thenReturn(null);

            service.initiateForgotPassword(new ForgotPasswordRequest("nobody@test.com"));

            verify(notificationClient, never()).sendEmail(any(), anyString(), anyString(), anyMap());
        }
    }

    @Nested
    class VerifyOtp {

        @Test
        void shouldVerifyOtpAndReturnResetToken() {
            when(identityClient.lookupByEmail("user@test.com")).thenReturn(
                    Map.of("userId", USER_ID.toString(), "tenantId", TENANT_ID.toString()));
            when(valueOps.get(contains("otp:password_reset:"))).thenReturn("123456:user@test.com");

            Map<String, String> result = service.verifyOtp(
                    new VerifyOtpRequest("user@test.com", "123456"));

            assertThat(result).containsKey("resetToken");
            assertThat(result.get("resetToken")).isNotBlank();

            // Verify OTP deleted and reset token stored
            verify(redisTemplate).delete(contains("otp:password_reset:"));
            verify(valueOps).set(contains("reset:"), anyString(), any());
        }

        @Test
        void shouldRejectInvalidOtp() {
            when(identityClient.lookupByEmail("user@test.com")).thenReturn(
                    Map.of("userId", USER_ID.toString(), "tenantId", TENANT_ID.toString()));
            when(valueOps.get(contains("otp:password_reset:"))).thenReturn("123456:user@test.com");

            assertThatThrownBy(() -> service.verifyOtp(
                    new VerifyOtpRequest("user@test.com", "999999")))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("Invalid or expired");
        }

        @Test
        void shouldRejectExpiredOtp() {
            when(identityClient.lookupByEmail("user@test.com")).thenReturn(
                    Map.of("userId", USER_ID.toString(), "tenantId", TENANT_ID.toString()));
            when(valueOps.get(contains("otp:password_reset:"))).thenReturn(null);

            assertThatThrownBy(() -> service.verifyOtp(
                    new VerifyOtpRequest("user@test.com", "123456")))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("Invalid or expired");
        }
    }

    @Nested
    class ResetPassword {

        @Test
        void shouldResetPasswordAndRevokeSessions() {
            String token = UUID.randomUUID().toString();
            when(valueOps.get("reset:" + token)).thenReturn(USER_ID + ":user@test.com");
            when(identityClient.lookupByEmail("user@test.com")).thenReturn(
                    Map.of("userId", USER_ID.toString(), "tenantId", TENANT_ID.toString()));

            Map<String, String> result = service.resetPassword(
                    new ResetPasswordRequest(token, "NewPassword123!"));

            assertThat(result.get("message")).contains("reset successfully");

            verify(credentialClient).resetPassword(eq(USER_ID), eq("NewPassword123!"), any());
            verify(sessionClient).revokeAllAccountSessions(USER_ID);
            verify(redisTemplate).delete("reset:" + token);
        }

        @Test
        void shouldRejectInvalidResetToken() {
            when(valueOps.get(contains("reset:"))).thenReturn(null);

            assertThatThrownBy(() -> service.resetPassword(
                    new ResetPasswordRequest("invalid-token", "NewPass123!")))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("Invalid or expired");
        }

        @Test
        void shouldSendNotificationOnSuccessfulReset() {
            String token = UUID.randomUUID().toString();
            when(valueOps.get("reset:" + token)).thenReturn(USER_ID + ":user@test.com");
            when(identityClient.lookupByEmail("user@test.com")).thenReturn(
                    Map.of("userId", USER_ID.toString(), "tenantId", TENANT_ID.toString()));

            service.resetPassword(new ResetPasswordRequest(token, "NewPassword123!"));

            verify(notificationClient).sendEmail(eq(TENANT_ID), eq("user@test.com"),
                    eq("password_reset_success"), anyMap());
        }
    }

    @Nested
    class OtpGeneration {

        @Test
        void shouldGenerateOtpOfCorrectLength() {
            String otp = service.generateOtp();
            assertThat(otp).hasSize(6);
            assertThat(otp).matches("\\d{6}");
        }
    }
}
