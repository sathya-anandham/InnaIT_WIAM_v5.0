package io.innait.wiam.notificationservice.service;

import io.innait.wiam.common.context.TenantContext;
import io.innait.wiam.notificationservice.entity.NotificationChannel;
import io.innait.wiam.notificationservice.entity.NotificationTemplate;
import io.innait.wiam.notificationservice.entity.PushProvider;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;

import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class NotificationServiceTest {

    @Mock private NotificationTemplateService templateService;
    @Mock private EmailProvider emailProvider;
    @Mock private SmsProvider smsProvider;
    @Mock private PushNotificationProvider pushProvider;
    @Mock private StringRedisTemplate redisTemplate;
    @Mock private ValueOperations<String, String> valueOps;

    private NotificationService service;
    private final UUID tenantId = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        service = new NotificationService(templateService, emailProvider, smsProvider,
                pushProvider, redisTemplate);
        TenantContext.setTenantId(tenantId);
    }

    @AfterEach
    void tearDown() {
        TenantContext.clear();
    }

    @Nested
    class SendEmail {

        @Test
        void shouldResolveTemplateAndSendEmail() {
            NotificationTemplate template = new NotificationTemplate(
                    UUID.randomUUID(), null, "welcome_email", NotificationChannel.EMAIL,
                    "Welcome {{displayName}}", "Hello {{displayName}}", true);

            when(templateService.resolveTemplate("welcome_email", NotificationChannel.EMAIL))
                    .thenReturn(template);
            when(templateService.renderSubject(eq(template), any())).thenReturn("Welcome John");
            when(templateService.renderBody(eq(template), any())).thenReturn("Hello John");

            service.sendEmail(tenantId, "john@test.com", "welcome_email",
                    Map.of("displayName", "John"));

            verify(emailProvider).send("john@test.com", "Welcome John", "Hello John");
        }
    }

    @Nested
    class SendSms {

        @Test
        void shouldSendSmsWithinRateLimit() {
            lenient().when(redisTemplate.opsForValue()).thenReturn(valueOps);
            when(valueOps.increment(anyString())).thenReturn(1L);

            NotificationTemplate template = new NotificationTemplate(
                    UUID.randomUUID(), null, "otp_sms", NotificationChannel.SMS,
                    null, "OTP: {{otpCode}}", true);

            when(templateService.resolveTemplate("otp_sms", NotificationChannel.SMS))
                    .thenReturn(template);
            when(templateService.renderBody(eq(template), any())).thenReturn("OTP: 123456");

            service.sendSms(tenantId, "+1234567890", "otp_sms",
                    Map.of("otpCode", "123456"));

            verify(smsProvider).send("+1234567890", "OTP: 123456");
        }

        @Test
        void shouldBlockSmsWhenRateLimitExceeded() {
            lenient().when(redisTemplate.opsForValue()).thenReturn(valueOps);
            when(valueOps.increment(anyString())).thenReturn(6L); // Over limit

            assertThatThrownBy(() -> service.sendSms(tenantId, "+1234567890", "otp_sms",
                    Map.of("otpCode", "123456", "accountId", "acc1")))
                    .isInstanceOf(NotificationService.RateLimitExceededException.class)
                    .hasMessageContaining("rate limit exceeded");
        }

        @Test
        void shouldAllowSmsWhenRedisUnavailable() {
            lenient().when(redisTemplate.opsForValue()).thenThrow(new RuntimeException("Redis down"));

            NotificationTemplate template = new NotificationTemplate(
                    UUID.randomUUID(), null, "otp_sms", NotificationChannel.SMS,
                    null, "OTP: {{otpCode}}", true);

            when(templateService.resolveTemplate("otp_sms", NotificationChannel.SMS))
                    .thenReturn(template);
            when(templateService.renderBody(eq(template), any())).thenReturn("OTP: 123456");

            // Should still send when Redis is down (graceful degradation)
            service.sendSms(tenantId, "+1234567890", "otp_sms", Map.of("otpCode", "123456"));

            verify(smsProvider).send("+1234567890", "OTP: 123456");
        }
    }

    @Nested
    class SendPush {

        @Test
        void shouldDelegateToPushProvider() {
            Map<String, String> data = Map.of("action", "approve");

            service.sendPush(tenantId, "device-token-123", PushProvider.FCM,
                    "Login", "Approve?", data);

            verify(pushProvider).send("device-token-123", PushProvider.FCM,
                    "Login", "Approve?", data);
        }
    }
}
