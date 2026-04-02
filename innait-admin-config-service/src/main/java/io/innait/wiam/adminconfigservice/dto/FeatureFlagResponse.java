package io.innait.wiam.adminconfigservice.dto;

import java.util.UUID;

public record FeatureFlagResponse(
        UUID featureFlagId,
        UUID tenantId,
        String flagKey,
        boolean flagValue,
        String description
) {}
