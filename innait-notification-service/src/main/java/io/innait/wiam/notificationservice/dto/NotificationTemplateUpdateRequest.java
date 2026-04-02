package io.innait.wiam.notificationservice.dto;

import io.innait.wiam.notificationservice.entity.NotificationChannel;
import jakarta.validation.constraints.NotNull;

public record NotificationTemplateUpdateRequest(
        @NotNull NotificationChannel channel,
        String subject,
        String bodyTemplate
) {
}
