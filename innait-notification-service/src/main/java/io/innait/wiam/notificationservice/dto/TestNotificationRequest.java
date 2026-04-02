package io.innait.wiam.notificationservice.dto;

import io.innait.wiam.notificationservice.entity.NotificationChannel;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.util.Map;

public record TestNotificationRequest(
        @NotNull NotificationChannel channel,
        @NotBlank String recipient,
        @NotBlank String templateKey,
        Map<String, String> variables
) {
}
