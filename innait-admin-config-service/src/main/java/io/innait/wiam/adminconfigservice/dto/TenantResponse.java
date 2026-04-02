package io.innait.wiam.adminconfigservice.dto;

import io.innait.wiam.adminconfigservice.entity.SubscriptionTier;
import io.innait.wiam.adminconfigservice.entity.TenantStatus;

import java.time.Instant;
import java.util.UUID;

public record TenantResponse(
        UUID tenantId,
        String tenantCode,
        String tenantName,
        TenantStatus status,
        SubscriptionTier subscriptionTier,
        String brandingConfig,
        Instant createdAt,
        Instant updatedAt
) {}
