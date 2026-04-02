package io.innait.wiam.notificationservice.service;

import io.innait.wiam.notificationservice.entity.PushProvider;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class PushNotificationProviderTest {

    private PushNotificationProvider provider;

    @BeforeEach
    void setUp() {
        provider = new PushNotificationProvider();
    }

    @Nested
    class PayloadConstruction {

        @Test
        void shouldBuildFcmPayload() {
            var payload = provider.buildPayload(
                    PushProvider.FCM, "fcm-device-token-123",
                    "Login Alert", "New login detected", Map.of("action", "verify"));

            assertThat(payload.provider()).isEqualTo(PushProvider.FCM);
            assertThat(payload.deviceToken()).isEqualTo("fcm-device-token-123");
            assertThat(payload.title()).isEqualTo("Login Alert");
            assertThat(payload.body()).isEqualTo("New login detected");
            assertThat(payload.data()).containsEntry("action", "verify");
        }

        @Test
        void shouldBuildApnsPayload() {
            var payload = provider.buildPayload(
                    PushProvider.APNS, "apns-token-abc",
                    "OTP Request", "Approve login?", Map.of());

            assertThat(payload.provider()).isEqualTo(PushProvider.APNS);
            assertThat(payload.deviceToken()).isEqualTo("apns-token-abc");
        }

        @Test
        void shouldBuildHmsPayload() {
            var payload = provider.buildPayload(
                    PushProvider.HMS, "hms-token-xyz",
                    "Security Alert", "Password changed", Map.of("severity", "high"));

            assertThat(payload.provider()).isEqualTo(PushProvider.HMS);
            assertThat(payload.data()).containsEntry("severity", "high");
        }

        @Test
        void shouldHandleNullData() {
            var payload = provider.buildPayload(
                    PushProvider.FCM, "token", "Title", "Body", null);

            assertThat(payload.data()).isNull();
        }
    }

    @Nested
    class SendRouting {

        @Test
        void shouldSendFcmWithoutError() {
            provider.send("token", PushProvider.FCM, "Title", "Body", Map.of());
        }

        @Test
        void shouldSendApnsWithoutError() {
            provider.send("token", PushProvider.APNS, "Title", "Body", Map.of());
        }

        @Test
        void shouldSendHmsWithoutError() {
            provider.send("token", PushProvider.HMS, "Title", "Body", Map.of());
        }
    }
}
