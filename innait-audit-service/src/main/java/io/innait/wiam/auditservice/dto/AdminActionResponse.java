package io.innait.wiam.auditservice.dto;

import java.time.Instant;
import java.util.UUID;

public record AdminActionResponse(
        UUID adminActionId,
        UUID tenantId,
        UUID adminId,
        String actionType,
        String targetType,
        UUID targetId,
        String beforeState,
        String afterState,
        String justification,
        Instant actionTime
) {
}
