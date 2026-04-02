package io.innait.wiam.notificationservice.dto;

import io.innait.wiam.notificationservice.entity.NotificationChannel;

import java.time.Instant;
import java.util.UUID;

public record NotificationTemplateResponse(
        UUID templateId,
        UUID tenantId,
        String templateKey,
        NotificationChannel channel,
        String subject,
        String bodyTemplate,
        boolean isDefault,
        boolean active,
        Instant createdAt,
        Instant updatedAt
) {
}
