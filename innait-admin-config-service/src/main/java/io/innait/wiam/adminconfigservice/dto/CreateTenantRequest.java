package io.innait.wiam.adminconfigservice.dto;

import io.innait.wiam.adminconfigservice.entity.SubscriptionTier;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CreateTenantRequest(
        @NotBlank @Size(max = 50) String tenantCode,
        @NotBlank @Size(max = 255) String tenantName,
        SubscriptionTier subscriptionTier,
        String adminEmail,
        String adminDisplayName
) {}
