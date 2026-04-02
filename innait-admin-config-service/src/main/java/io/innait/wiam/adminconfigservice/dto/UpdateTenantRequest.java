package io.innait.wiam.adminconfigservice.dto;

import io.innait.wiam.adminconfigservice.entity.SubscriptionTier;
import io.innait.wiam.adminconfigservice.entity.TenantStatus;

public record UpdateTenantRequest(
        String tenantName,
        TenantStatus status,
        SubscriptionTier subscriptionTier,
        String brandingConfig
) {}
