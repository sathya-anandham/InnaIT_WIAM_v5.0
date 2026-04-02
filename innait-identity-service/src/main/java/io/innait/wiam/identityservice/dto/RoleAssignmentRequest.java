package io.innait.wiam.identityservice.dto;

import jakarta.validation.constraints.NotNull;

import java.time.Instant;
import java.util.UUID;

public record RoleAssignmentRequest(
        @NotNull UUID roleId,
        @NotNull String assignmentSource,
        UUID assignedBy,
        String reason,
        Instant expiryAt
) {
}
