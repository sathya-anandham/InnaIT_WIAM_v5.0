package io.innait.wiam.credentialservice.dto;

import jakarta.validation.constraints.NotNull;

import java.util.UUID;

public record CreateAssignmentRequest(
        @NotNull UUID deviceId,
        UUID userId,
        @NotNull UUID accountId
) {
}
