package io.innait.wiam.identityservice.dto;

import java.time.Instant;
import java.util.UUID;

public record RoleAssignmentResponse(
        UUID mappingId,
        UUID accountId,
        UUID roleId,
        String roleCode,
        String roleName,
        String assignmentSource,
        boolean active,
        Instant assignedAt,
        Instant removedAt
) {
}
