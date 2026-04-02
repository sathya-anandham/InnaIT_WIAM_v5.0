package io.innait.wiam.credentialservice.dto;

import jakarta.validation.constraints.NotBlank;

public record SoftTokenVerifyRequest(
        @NotBlank String challengeId,
        @NotBlank String signedResponse
) {
}
