package io.innait.wiam.credentialservice.dto;

import jakarta.validation.constraints.NotBlank;

public record RevokeAssignmentRequest(
        @NotBlank String reason
) {
}
