package io.innait.wiam.identityservice.dto;

import jakarta.validation.constraints.NotNull;

import java.util.UUID;

public record GroupMemberRequest(
        @NotNull UUID accountId,
        @NotNull String assignmentSource,
        UUID assignedBy,
        String reason
) {
}
