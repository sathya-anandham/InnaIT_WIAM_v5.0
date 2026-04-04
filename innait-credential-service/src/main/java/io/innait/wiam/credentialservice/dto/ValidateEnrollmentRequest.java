package io.innait.wiam.credentialservice.dto;

import jakarta.validation.constraints.NotNull;

import java.util.UUID;

public record ValidateEnrollmentRequest(
        @NotNull UUID accountId,
        @NotNull UUID deviceId
) {
}
