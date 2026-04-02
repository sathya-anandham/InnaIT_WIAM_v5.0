package io.innait.wiam.notificationservice.service;

import io.innait.wiam.common.context.TenantContext;
import io.innait.wiam.notificationservice.entity.NotificationChannel;
import io.innait.wiam.notificationservice.entity.NotificationTemplate;
import io.innait.wiam.notificationservice.repository.NotificationTemplateRepository;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class NotificationTemplateServiceTest {

    @Mock private NotificationTemplateRepository repository;
    private NotificationTemplateService service;

    private final UUID tenantId = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        service = new NotificationTemplateService(repository);
        TenantContext.setTenantId(tenantId);
    }

    @AfterEach
    void tearDown() {
        TenantContext.clear();
    }

    @Nested
    class VariableSubstitution {

        @Test
        void shouldSubstituteAllVariables() {
            String template = "Hello {{displayName}}, your OTP is {{otpCode}}. It expires in {{expiryMinutes}} minutes.";
            Map<String, String> vars = Map.of(
                    "displayName", "John",
                    "otpCode", "123456",
                    "expiryMinutes", "5"
            );

            String result = service.render(template, vars);
            assertThat(result).isEqualTo("Hello John, your OTP is 123456. It expires in 5 minutes.");
        }

        @Test
        void shouldHandleMissingVariables() {
            String template = "Hello {{displayName}}, welcome to {{tenantName}}!";
            Map<String, String> vars = Map.of("displayName", "Alice");

            String result = service.render(template, vars);
            assertThat(result).isEqualTo("Hello Alice, welcome to !");
        }

        @Test
        void shouldHandleNoVariables() {
            String template = "This is a plain message with no variables.";
            String result = service.render(template, Map.of());
            assertThat(result).isEqualTo(template);
        }

        @Test
        void shouldHandleNullTemplate() {
            assertThat(service.render(null, Map.of())).isNull();
        }

        @Test
        void shouldHandleNullVariables() {
            String template = "Hello {{displayName}}";
            assertThat(service.render(template, null)).isEqualTo(template);
        }

        @Test
        void shouldSubstituteWelcomeEmailTemplate() {
            String template = "Welcome {{displayName}}! Login at {{loginUrl}} for {{tenantName}}.";
            Map<String, String> vars = Map.of(
                    "displayName", "Jane Doe",
                    "loginUrl", "https://auth.innait.io/login",
                    "tenantName", "Acme Corp"
            );
            String result = service.render(template, vars);
            assertThat(result).isEqualTo("Welcome Jane Doe! Login at https://auth.innait.io/login for Acme Corp.");
        }

        @Test
        void shouldSubstituteOtpSmsTemplate() {
            String template = "Your InnaIT OTP: {{otpCode}}. Valid for {{expiryMinutes}} min. Do not share.";
            Map<String, String> vars = Map.of("otpCode", "982751", "expiryMinutes", "5");
            String result = service.render(template, vars);
            assertThat(result).isEqualTo("Your InnaIT OTP: 982751. Valid for 5 min. Do not share.");
        }

        @Test
        void shouldSubstitutePasswordResetTemplate() {
            String template = "Hi {{displayName}}, reset your password: {{loginUrl}}?token={{resetToken}}";
            Map<String, String> vars = Map.of(
                    "displayName", "Bob",
                    "loginUrl", "https://auth.innait.io",
                    "resetToken", "abc123"
            );
            String result = service.render(template, vars);
            assertThat(result).isEqualTo("Hi Bob, reset your password: https://auth.innait.io?token=abc123");
        }
    }

    @Nested
    class TemplateResolution {

        @Test
        void shouldReturnTenantOverrideWhenExists() {
            NotificationTemplate tenantTemplate = new NotificationTemplate(
                    UUID.randomUUID(), tenantId, "welcome_email", NotificationChannel.EMAIL,
                    "Custom Welcome", "Custom body", false);

            when(repository.findTenantTemplate(tenantId, "welcome_email", NotificationChannel.EMAIL))
                    .thenReturn(Optional.of(tenantTemplate));

            NotificationTemplate result = service.resolveTemplate("welcome_email", NotificationChannel.EMAIL);
            assertThat(result.getSubject()).isEqualTo("Custom Welcome");
        }

        @Test
        void shouldFallBackToDefaultWhenNoTenantOverride() {
            NotificationTemplate defaultTemplate = new NotificationTemplate(
                    UUID.randomUUID(), null, "welcome_email", NotificationChannel.EMAIL,
                    "Default Welcome", "Default body", true);

            when(repository.findTenantTemplate(tenantId, "welcome_email", NotificationChannel.EMAIL))
                    .thenReturn(Optional.empty());
            when(repository.findDefaultTemplate("welcome_email", NotificationChannel.EMAIL))
                    .thenReturn(Optional.of(defaultTemplate));

            NotificationTemplate result = service.resolveTemplate("welcome_email", NotificationChannel.EMAIL);
            assertThat(result.getSubject()).isEqualTo("Default Welcome");
            assertThat(result.isDefault()).isTrue();
        }

        @Test
        void shouldThrowWhenNoTemplateFound() {
            when(repository.findTenantTemplate(tenantId, "nonexistent", NotificationChannel.EMAIL))
                    .thenReturn(Optional.empty());
            when(repository.findDefaultTemplate("nonexistent", NotificationChannel.EMAIL))
                    .thenReturn(Optional.empty());

            assertThatThrownBy(() -> service.resolveTemplate("nonexistent", NotificationChannel.EMAIL))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("No template found");
        }
    }
}
