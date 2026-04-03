package io.innait.wiam.notificationservice.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.icegreen.greenmail.configuration.GreenMailConfiguration;
import com.icegreen.greenmail.junit5.GreenMailExtension;
import com.icegreen.greenmail.util.ServerSetupTest;
import io.innait.wiam.common.context.TenantContext;
import io.innait.wiam.common.event.EventEnvelope;
import io.innait.wiam.common.exception.GlobalExceptionHandler;
import io.innait.wiam.common.security.JwtAuthenticationFilter;
import io.innait.wiam.notificationservice.dto.NotificationTemplateUpdateRequest;
import io.innait.wiam.notificationservice.dto.TestNotificationRequest;
import io.innait.wiam.notificationservice.entity.NotificationChannel;
import io.innait.wiam.notificationservice.entity.NotificationTemplate;
import io.innait.wiam.notificationservice.repository.NotificationTemplateRepository;
import io.innait.wiam.notificationservice.service.NotificationEventConsumer;
import jakarta.mail.internet.MimeMessage;
import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.extension.RegisterExtension;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.MediaType;
import org.springframework.context.annotation.Import;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc(addFilters = false)
@ActiveProfiles("test")
@Import(GlobalExceptionHandler.class)
class NotificationControllerIntegrationTest {

    @RegisterExtension
    static GreenMailExtension greenMail = new GreenMailExtension(ServerSetupTest.SMTP)
            .withConfiguration(GreenMailConfiguration.aConfig().withDisabledAuthentication());

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;
    @Autowired private NotificationTemplateRepository templateRepository;
    @Autowired private NotificationEventConsumer eventConsumer;

    @MockBean private JwtAuthenticationFilter jwtAuthenticationFilter;
    @MockBean private StringRedisTemplate redisTemplate;

    private static final UUID TENANT_ID = UUID.randomUUID();
    private static final UUID TENANT_ID_B = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        TenantContext.setTenantId(TENANT_ID);
        greenMail.reset();
    }

    @AfterEach
    void tearDown() {
        TenantContext.clear();
        templateRepository.deleteAll();
    }

    // ---- Helpers ----

    private NotificationTemplate seedDefaultTemplate(String key, NotificationChannel channel,
                                                      String subject, String body) {
        NotificationTemplate t = new NotificationTemplate(
                UUID.randomUUID(), null, key, channel, subject, body, true);
        return templateRepository.save(t);
    }

    private NotificationTemplate seedTenantTemplate(UUID tenantId, String key,
                                                     NotificationChannel channel,
                                                     String subject, String body) {
        NotificationTemplate t = new NotificationTemplate(
                UUID.randomUUID(), tenantId, key, channel, subject, body, false);
        return templateRepository.save(t);
    }

    // ======================================================================
    //  1. Email sending via GreenMail (embedded SMTP)
    // ======================================================================
    @Nested
    @WithMockUser(roles = "SUPER_ADMIN")
    class EmailViaGreenMail {

        @Test
        void shouldSendEmailAndCaptureViaGreenMail() throws Exception {
            seedDefaultTemplate("welcome_email", NotificationChannel.EMAIL,
                    "Welcome {{displayName}}", "Hello {{displayName}}, welcome to {{tenantName}}!");

            TestNotificationRequest request = new TestNotificationRequest(
                    NotificationChannel.EMAIL, "john@test.com", "welcome_email",
                    Map.of("displayName", "John", "tenantName", "Acme Corp"));

            mockMvc.perform(post("/api/v1/notifications/test")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.data").value("Notification sent successfully"));

            // Verify email was actually delivered to GreenMail
            MimeMessage[] messages = greenMail.getReceivedMessages();
            assertThat(messages).hasSize(1);

            MimeMessage msg = messages[0];
            assertThat(msg.getSubject()).isEqualTo("Welcome John");
            assertThat(msg.getAllRecipients()[0].toString()).isEqualTo("john@test.com");
            String content = msg.getContent().toString().trim();
            assertThat(content).contains("Hello John, welcome to Acme Corp!");
        }

        @Test
        void shouldSendEmailWithMultipleVariables() throws Exception {
            seedDefaultTemplate("password_reset", NotificationChannel.EMAIL,
                    "Password Reset for {{displayName}}",
                    "Hi {{displayName}}, reset your password: {{loginUrl}}?token={{resetToken}}");

            TestNotificationRequest request = new TestNotificationRequest(
                    NotificationChannel.EMAIL, "alice@test.com", "password_reset",
                    Map.of("displayName", "Alice", "loginUrl", "https://auth.innait.io",
                            "resetToken", "tok-abc-123"));

            mockMvc.perform(post("/api/v1/notifications/test")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isOk());

            MimeMessage[] messages = greenMail.getReceivedMessages();
            assertThat(messages).hasSize(1);
            assertThat(messages[0].getSubject()).isEqualTo("Password Reset for Alice");
            String body = messages[0].getContent().toString().trim();
            assertThat(body).contains("https://auth.innait.io?token=tok-abc-123");
        }

        @Test
        void shouldSendMultipleEmailsToSameRecipient() throws Exception {
            seedDefaultTemplate("alert_email", NotificationChannel.EMAIL,
                    "Alert: {{alertType}}", "Security alert: {{alertType}} at {{time}}");

            for (int i = 1; i <= 3; i++) {
                TestNotificationRequest request = new TestNotificationRequest(
                        NotificationChannel.EMAIL, "admin@test.com", "alert_email",
                        Map.of("alertType", "Alert-" + i, "time", "2026-04-02T10:0" + i));

                mockMvc.perform(post("/api/v1/notifications/test")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(objectMapper.writeValueAsString(request)))
                        .andExpect(status().isOk());
            }

            MimeMessage[] messages = greenMail.getReceivedMessages();
            assertThat(messages).hasSize(3);
            assertThat(messages[0].getSubject()).isEqualTo("Alert: Alert-1");
            assertThat(messages[2].getSubject()).isEqualTo("Alert: Alert-3");
        }
    }

    // ======================================================================
    //  2. Template override per tenant
    // ======================================================================
    @Nested
    @WithMockUser(roles = "TENANT_ADMIN")
    class TemplateOverridePerTenant {

        @Test
        void shouldReturnDefaultTemplateWhenNoOverride() throws Exception {
            seedDefaultTemplate("welcome_email", NotificationChannel.EMAIL,
                    "Default Welcome", "Default body {{displayName}}");

            mockMvc.perform(get("/api/v1/notifications/templates"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.data", hasSize(1)))
                    .andExpect(jsonPath("$.data[0].subject").value("Default Welcome"))
                    .andExpect(jsonPath("$.data[0].isDefault").value(true));
        }

        @Test
        void shouldReturnTenantOverrideInsteadOfDefault() throws Exception {
            seedDefaultTemplate("welcome_email", NotificationChannel.EMAIL,
                    "Default Welcome", "Default body");
            seedTenantTemplate(TENANT_ID, "welcome_email", NotificationChannel.EMAIL,
                    "Custom Welcome for Tenant", "Custom body for tenant");

            mockMvc.perform(get("/api/v1/notifications/templates"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.data", hasSize(1)))
                    .andExpect(jsonPath("$.data[0].subject").value("Custom Welcome for Tenant"))
                    .andExpect(jsonPath("$.data[0].isDefault").value(false));
        }

        @Test
        void shouldCreateTenantOverrideOnUpdate() throws Exception {
            seedDefaultTemplate("otp_sms", NotificationChannel.SMS,
                    null, "Your OTP: {{otpCode}}");

            NotificationTemplateUpdateRequest updateReq = new NotificationTemplateUpdateRequest(
                    NotificationChannel.SMS, null, "Custom OTP: {{otpCode}} (Tenant)");

            mockMvc.perform(put("/api/v1/notifications/templates/otp_sms")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(updateReq)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.data.bodyTemplate").value("Custom OTP: {{otpCode}} (Tenant)"))
                    .andExpect(jsonPath("$.data.isDefault").value(false))
                    .andExpect(jsonPath("$.data.tenantId").isNotEmpty());

            // Default still exists unchanged
            var defaultTemplate = templateRepository.findDefaultTemplate("otp_sms", NotificationChannel.SMS);
            assertThat(defaultTemplate).isPresent();
            assertThat(defaultTemplate.get().getBodyTemplate()).isEqualTo("Your OTP: {{otpCode}}");
        }

        @Test
        void shouldUpdateExistingTenantOverride() throws Exception {
            seedDefaultTemplate("welcome_email", NotificationChannel.EMAIL,
                    "Default Welcome", "Default body");
            seedTenantTemplate(TENANT_ID, "welcome_email", NotificationChannel.EMAIL,
                    "Custom V1", "Custom body V1");

            NotificationTemplateUpdateRequest updateReq = new NotificationTemplateUpdateRequest(
                    NotificationChannel.EMAIL, "Custom V2", "Custom body V2");

            mockMvc.perform(put("/api/v1/notifications/templates/welcome_email")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(updateReq)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.data.subject").value("Custom V2"))
                    .andExpect(jsonPath("$.data.bodyTemplate").value("Custom body V2"));
        }

        @Test
        void shouldSendEmailUsingTenantOverrideTemplate() throws Exception {
            seedDefaultTemplate("welcome_email", NotificationChannel.EMAIL,
                    "Default Welcome {{displayName}}", "Default welcome body for {{displayName}}");
            seedTenantTemplate(TENANT_ID, "welcome_email", NotificationChannel.EMAIL,
                    "Custom Welcome {{displayName}} from Acme",
                    "Acme Inc welcomes {{displayName}}!");

            TestNotificationRequest request = new TestNotificationRequest(
                    NotificationChannel.EMAIL, "user@test.com", "welcome_email",
                    Map.of("displayName", "Bob"));

            mockMvc.perform(post("/api/v1/notifications/test")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isOk());

            MimeMessage[] messages = greenMail.getReceivedMessages();
            assertThat(messages).hasSize(1);
            // Should use tenant override, not default
            assertThat(messages[0].getSubject()).isEqualTo("Custom Welcome Bob from Acme");
            String body = messages[0].getContent().toString().trim();
            assertThat(body).isEqualTo("Acme Inc welcomes Bob!");
        }

        @Test
        void shouldIsolateTenantTemplatesFromOtherTenants() throws Exception {
            seedDefaultTemplate("welcome_email", NotificationChannel.EMAIL,
                    "Default Welcome", "Default body");
            // Tenant B override should NOT be visible to Tenant A
            seedTenantTemplate(TENANT_ID_B, "welcome_email", NotificationChannel.EMAIL,
                    "Tenant B Welcome", "Tenant B body");

            // Current context is TENANT_ID (A) — should see default, not B's override
            mockMvc.perform(get("/api/v1/notifications/templates"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.data", hasSize(1)))
                    .andExpect(jsonPath("$.data[0].subject").value("Default Welcome"))
                    .andExpect(jsonPath("$.data[0].isDefault").value(true));
        }
    }

    // ======================================================================
    //  3. SMS via test endpoint (mock gateway)
    // ======================================================================
    @Nested
    @WithMockUser(roles = "SUPER_ADMIN")
    class SmsViaTestEndpoint {

        @Test
        void shouldRejectTestSmsWhenTemplateNotFound() throws Exception {
            TestNotificationRequest request = new TestNotificationRequest(
                    NotificationChannel.SMS, "+1234567890", "nonexistent_template",
                    Map.of("otpCode", "123456"));

            mockMvc.perform(post("/api/v1/notifications/test")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isBadRequest());
        }
    }

    // ======================================================================
    //  4. Kafka trigger → notification sent
    // ======================================================================
    @Nested
    class KafkaTriggerNotification {

        @Test
        void shouldSendWelcomeEmailOnUserCreatedEvent() throws Exception {
            seedDefaultTemplate("welcome_email", NotificationChannel.EMAIL,
                    "Welcome {{displayName}}", "Hello {{displayName}}, welcome to {{tenantName}}!");

            // Simulate Kafka event by calling consumer directly
            Map<String, Object> payload = Map.of(
                    "email", "newuser@test.com",
                    "display_name", "Jane Doe",
                    "login_url", "https://auth.innait.io/login",
                    "tenant_name", "TechCorp"
            );

            EventEnvelope<Map<String, Object>> envelope = EventEnvelope.<Map<String, Object>>builder()
                    .eventId(UUID.randomUUID())
                    .eventType("user.created")
                    .tenantId(TENANT_ID)
                    .timestamp(Instant.now())
                    .source("innait-identity-service")
                    .payload(payload)
                    .build();

            ConsumerRecord<String, EventEnvelope<?>> record = new ConsumerRecord<>(
                    "innait.identity.user.created", 0, 0, null, envelope);

            eventConsumer.onEvent(record);

            // Verify welcome email was sent via GreenMail
            MimeMessage[] messages = greenMail.getReceivedMessages();
            assertThat(messages).hasSize(1);
            assertThat(messages[0].getSubject()).isEqualTo("Welcome Jane Doe");
            assertThat(messages[0].getAllRecipients()[0].toString()).isEqualTo("newuser@test.com");
            String body = messages[0].getContent().toString().trim();
            assertThat(body).contains("Hello Jane Doe, welcome to TechCorp!");
        }

        @Test
        void shouldSendEmailOnCredentialEnrolledEvent() throws Exception {
            seedDefaultTemplate("credential_enrolled", NotificationChannel.EMAIL,
                    "Credential Enrolled: {{credentialType}}",
                    "Hi {{displayName}}, your {{credentialType}} has been enrolled.");

            Map<String, Object> payload = Map.of(
                    "email", "bob@test.com",
                    "display_name", "Bob",
                    "credential_type", "TOTP"
            );

            EventEnvelope<Map<String, Object>> envelope = EventEnvelope.<Map<String, Object>>builder()
                    .eventId(UUID.randomUUID())
                    .eventType("credential.enrolled")
                    .tenantId(TENANT_ID)
                    .timestamp(Instant.now())
                    .source("innait-credential-service")
                    .payload(payload)
                    .build();

            ConsumerRecord<String, EventEnvelope<?>> record = new ConsumerRecord<>(
                    "innait.credential.enrolled", 0, 0, null, envelope);

            eventConsumer.onEvent(record);

            MimeMessage[] messages = greenMail.getReceivedMessages();
            assertThat(messages).hasSize(1);
            assertThat(messages[0].getSubject()).isEqualTo("Credential Enrolled: TOTP");
            String body = messages[0].getContent().toString().trim();
            assertThat(body).contains("your TOTP has been enrolled");
        }

        @Test
        void shouldSkipNotificationWhenNoEmailInEvent() throws Exception {
            seedDefaultTemplate("welcome_email", NotificationChannel.EMAIL,
                    "Welcome {{displayName}}", "Hello {{displayName}}!");

            // Event without email field
            Map<String, Object> payload = Map.of(
                    "display_name", "No Email User"
            );

            EventEnvelope<Map<String, Object>> envelope = EventEnvelope.<Map<String, Object>>builder()
                    .eventId(UUID.randomUUID())
                    .eventType("user.created")
                    .tenantId(TENANT_ID)
                    .timestamp(Instant.now())
                    .source("innait-identity-service")
                    .payload(payload)
                    .build();

            ConsumerRecord<String, EventEnvelope<?>> record = new ConsumerRecord<>(
                    "innait.identity.user.created", 0, 0, null, envelope);

            eventConsumer.onEvent(record);

            // No email should be sent
            MimeMessage[] messages = greenMail.getReceivedMessages();
            assertThat(messages).isEmpty();
        }

        @Test
        void shouldSkipEventWithNullEnvelope() throws Exception {
            ConsumerRecord<String, EventEnvelope<?>> record = new ConsumerRecord<>(
                    "innait.identity.user.created", 0, 0, null, null);

            // Should not throw
            eventConsumer.onEvent(record);

            MimeMessage[] messages = greenMail.getReceivedMessages();
            assertThat(messages).isEmpty();
        }

        @Test
        void shouldUseDefaultDisplayNameWhenMissing() throws Exception {
            seedDefaultTemplate("welcome_email", NotificationChannel.EMAIL,
                    "Welcome {{displayName}}", "Hello {{displayName}}!");

            Map<String, Object> payload = Map.of(
                    "email", "noname@test.com"
            );

            EventEnvelope<Map<String, Object>> envelope = EventEnvelope.<Map<String, Object>>builder()
                    .eventId(UUID.randomUUID())
                    .eventType("user.created")
                    .tenantId(TENANT_ID)
                    .timestamp(Instant.now())
                    .source("innait-identity-service")
                    .payload(payload)
                    .build();

            ConsumerRecord<String, EventEnvelope<?>> record = new ConsumerRecord<>(
                    "innait.identity.user.created", 0, 0, null, envelope);

            eventConsumer.onEvent(record);

            MimeMessage[] messages = greenMail.getReceivedMessages();
            assertThat(messages).hasSize(1);
            // Default display name is "User"
            assertThat(messages[0].getSubject()).isEqualTo("Welcome User");
        }

        @Test
        void shouldUseOverrideTemplateForKafkaTriggeredNotification() throws Exception {
            seedDefaultTemplate("welcome_email", NotificationChannel.EMAIL,
                    "Default Welcome {{displayName}}", "Default body for {{displayName}}");
            seedTenantTemplate(TENANT_ID, "welcome_email", NotificationChannel.EMAIL,
                    "Custom Welcome {{displayName}}", "{{tenantName}} welcomes {{displayName}}!");

            Map<String, Object> payload = Map.of(
                    "email", "vip@test.com",
                    "display_name", "VIP User",
                    "tenant_name", "Premium Corp"
            );

            EventEnvelope<Map<String, Object>> envelope = EventEnvelope.<Map<String, Object>>builder()
                    .eventId(UUID.randomUUID())
                    .eventType("user.created")
                    .tenantId(TENANT_ID)
                    .timestamp(Instant.now())
                    .source("innait-identity-service")
                    .payload(payload)
                    .build();

            ConsumerRecord<String, EventEnvelope<?>> record = new ConsumerRecord<>(
                    "innait.identity.user.created", 0, 0, null, envelope);

            eventConsumer.onEvent(record);

            MimeMessage[] messages = greenMail.getReceivedMessages();
            assertThat(messages).hasSize(1);
            // Should use tenant override template
            assertThat(messages[0].getSubject()).isEqualTo("Custom Welcome VIP User");
            String body = messages[0].getContent().toString().trim();
            assertThat(body).isEqualTo("Premium Corp welcomes VIP User!");
        }
    }

    // ======================================================================
    //  5. REST API contract tests
    // ======================================================================
    @Nested
    @WithMockUser(roles = "SUPER_ADMIN")
    class RestApiContract {

        @Test
        void shouldListAllTemplates() throws Exception {
            seedDefaultTemplate("welcome_email", NotificationChannel.EMAIL,
                    "Welcome", "Body");
            seedDefaultTemplate("otp_sms", NotificationChannel.SMS,
                    null, "OTP: {{otpCode}}");

            mockMvc.perform(get("/api/v1/notifications/templates"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.data", hasSize(2)));
        }

        @Test
        void shouldReturnCorrectTemplateStructure() throws Exception {
            seedDefaultTemplate("welcome_email", NotificationChannel.EMAIL,
                    "Welcome {{displayName}}", "Hello {{displayName}}");

            mockMvc.perform(get("/api/v1/notifications/templates"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.data[0].templateId").isNotEmpty())
                    .andExpect(jsonPath("$.data[0].templateKey").value("welcome_email"))
                    .andExpect(jsonPath("$.data[0].channel").value("EMAIL"))
                    .andExpect(jsonPath("$.data[0].subject").value("Welcome {{displayName}}"))
                    .andExpect(jsonPath("$.data[0].bodyTemplate").value("Hello {{displayName}}"))
                    .andExpect(jsonPath("$.data[0].isDefault").value(true))
                    .andExpect(jsonPath("$.data[0].active").value(true));
        }

        @Test
        void shouldRejectInvalidTestNotificationRequest() throws Exception {
            // Missing required fields
            String invalidJson = "{}";

            mockMvc.perform(post("/api/v1/notifications/test")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(invalidJson))
                    .andExpect(status().is4xxClientError());
        }
    }
}
