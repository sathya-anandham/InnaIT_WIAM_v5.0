package io.innait.wiam.notificationservice.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class SmsProviderTest {

    private SmsProvider smsProvider;

    @BeforeEach
    void setUp() {
        smsProvider = new SmsProvider();
    }

    @Nested
    class MessageFormatting {

        @Test
        void shouldKeepShortMessage() {
            String msg = "Your OTP is 123456";
            assertThat(smsProvider.formatMessage(msg)).isEqualTo(msg);
        }

        @Test
        void shouldTruncateLongMessage() {
            String longMsg = "A".repeat(200);
            String result = smsProvider.formatMessage(longMsg);
            assertThat(result).hasSize(160);
            assertThat(result).endsWith("...");
        }

        @Test
        void shouldHandleExactly160Chars() {
            String exact = "X".repeat(160);
            assertThat(smsProvider.formatMessage(exact)).hasSize(160);
            assertThat(smsProvider.formatMessage(exact)).doesNotEndWith("...");
        }

        @Test
        void shouldHandleNullMessage() {
            assertThat(smsProvider.formatMessage(null)).isEmpty();
        }

        @Test
        void shouldHandleEmptyMessage() {
            assertThat(smsProvider.formatMessage("")).isEmpty();
        }
    }
}
