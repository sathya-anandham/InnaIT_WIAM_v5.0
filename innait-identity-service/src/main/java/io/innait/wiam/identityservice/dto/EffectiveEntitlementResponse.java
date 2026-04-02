package io.innait.wiam.identityservice.dto;

import java.util.UUID;

public record EffectiveEntitlementResponse(
        UUID entitlementId,
        String entitlementCode,
        String entitlementName,
        String entitlementType,
        UUID sourceRoleId,
        String sourceRoleCode,
        String resolutionPath
) {
}
