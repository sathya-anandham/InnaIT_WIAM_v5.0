package io.innait.wiam.adminconfigservice.service;

import io.innait.wiam.adminconfigservice.dto.SystemSettingResponse;
import io.innait.wiam.adminconfigservice.entity.SettingValueType;
import io.innait.wiam.adminconfigservice.entity.SystemSetting;
import io.innait.wiam.adminconfigservice.repository.SystemSettingRepository;
import io.innait.wiam.common.kafka.EventPublisher;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class SystemSettingsServiceTest {

    @Mock private SystemSettingRepository repository;
    @Mock private EventPublisher eventPublisher;

    private SystemSettingsService service;
    private final UUID tenantId = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        service = new SystemSettingsService(repository, eventPublisher);
    }

    @Nested
    class SettingResolutionHierarchy {

        @Test
        void shouldReturnTenantOverrideWhenExists() {
            SystemSetting tenantSetting = new SystemSetting(
                    tenantId, "session.idle.timeout.minutes", "15",
                    SettingValueType.NUMBER, null, false);
            when(repository.findTenantSetting(tenantId, "session.idle.timeout.minutes"))
                    .thenReturn(Optional.of(tenantSetting));

            String value = service.getSetting(tenantId, "session.idle.timeout.minutes");
            assertThat(value).isEqualTo("15");
        }

        @Test
        void shouldFallBackToGlobalWhenNoTenantOverride() {
            when(repository.findTenantSetting(tenantId, "session.idle.timeout.minutes"))
                    .thenReturn(Optional.empty());

            SystemSetting globalSetting = new SystemSetting(
                    null, "session.idle.timeout.minutes", "30",
                    SettingValueType.NUMBER, null, false);
            when(repository.findGlobalSetting("session.idle.timeout.minutes"))
                    .thenReturn(Optional.of(globalSetting));

            String value = service.getSetting(tenantId, "session.idle.timeout.minutes");
            assertThat(value).isEqualTo("30");
        }

        @Test
        void shouldReturnNullWhenSettingNotFound() {
            when(repository.findTenantSetting(tenantId, "nonexistent"))
                    .thenReturn(Optional.empty());
            when(repository.findGlobalSetting("nonexistent"))
                    .thenReturn(Optional.empty());

            String value = service.getSetting(tenantId, "nonexistent");
            assertThat(value).isNull();
        }

        @Test
        void shouldReturnGlobalOnlyWhenTenantIdNull() {
            SystemSetting globalSetting = new SystemSetting(
                    null, "otp.validity.seconds", "300",
                    SettingValueType.NUMBER, null, false);
            when(repository.findGlobalSetting("otp.validity.seconds"))
                    .thenReturn(Optional.of(globalSetting));

            String value = service.getSetting(null, "otp.validity.seconds");
            assertThat(value).isEqualTo("300");
        }
    }

    @Nested
    class SettingOverrides {

        @Test
        void shouldCreateTenantOverride() {
            when(repository.findTenantSetting(tenantId, "session.idle.timeout.minutes"))
                    .thenReturn(Optional.empty());
            SystemSetting globalSetting = new SystemSetting(
                    null, "session.idle.timeout.minutes", "30",
                    SettingValueType.NUMBER, null, false);
            when(repository.findGlobalSetting("session.idle.timeout.minutes"))
                    .thenReturn(Optional.of(globalSetting));
            when(repository.save(any())).thenAnswer(i -> i.getArgument(0));

            SystemSettingResponse response = service.setSetting(
                    tenantId, "session.idle.timeout.minutes", "15");

            assertThat(response.settingValue()).isEqualTo("15");
            assertThat(response.tenantOverride()).isTrue();
            verify(repository).save(any(SystemSetting.class));
        }

        @Test
        void shouldUpdateExistingTenantOverride() {
            SystemSetting existing = new SystemSetting(
                    tenantId, "session.idle.timeout.minutes", "15",
                    SettingValueType.NUMBER, null, false);
            when(repository.findTenantSetting(tenantId, "session.idle.timeout.minutes"))
                    .thenReturn(Optional.of(existing));
            when(repository.save(any())).thenAnswer(i -> i.getArgument(0));

            service.setSetting(tenantId, "session.idle.timeout.minutes", "10");

            assertThat(existing.getSettingValue()).isEqualTo("10");
        }
    }

    @Nested
    class MergedSettingsList {

        @Test
        void shouldMergeGlobalAndTenantSettings() {
            SystemSetting global1 = new SystemSetting(null, "otp.validity.seconds", "300",
                    SettingValueType.NUMBER, "OTP TTL", false);
            SystemSetting global2 = new SystemSetting(null, "session.idle.timeout.minutes", "30",
                    SettingValueType.NUMBER, "Session timeout", false);
            SystemSetting tenantOverride = new SystemSetting(tenantId, "session.idle.timeout.minutes", "15",
                    SettingValueType.NUMBER, null, false);

            when(repository.findAllGlobalSettings()).thenReturn(List.of(global1, global2));
            when(repository.findAllTenantSettings(tenantId)).thenReturn(List.of(tenantOverride));

            List<SystemSettingResponse> result = service.listSettings(tenantId);

            assertThat(result).hasSize(2);

            // session timeout should be tenant override (15)
            SystemSettingResponse sessionTimeout = result.stream()
                    .filter(s -> "session.idle.timeout.minutes".equals(s.settingKey()))
                    .findFirst().orElseThrow();
            assertThat(sessionTimeout.settingValue()).isEqualTo("15");
            assertThat(sessionTimeout.tenantOverride()).isTrue();

            // otp should still be global (300)
            SystemSettingResponse otpTtl = result.stream()
                    .filter(s -> "otp.validity.seconds".equals(s.settingKey()))
                    .findFirst().orElseThrow();
            assertThat(otpTtl.settingValue()).isEqualTo("300");
            assertThat(otpTtl.tenantOverride()).isFalse();
        }

        @Test
        void shouldMaskSensitiveSettings() {
            SystemSetting sensitive = new SystemSetting(null, "api.secret", "super-secret",
                    SettingValueType.STRING, null, true);
            when(repository.findAllGlobalSettings()).thenReturn(List.of(sensitive));

            List<SystemSettingResponse> result = service.listSettings(null);

            assertThat(result).hasSize(1);
            assertThat(result.get(0).settingValue()).isEqualTo("***");
            assertThat(result.get(0).sensitive()).isTrue();
        }
    }
}
