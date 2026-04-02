package io.innait.wiam.credentialservice.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.util.UUID;

public record FidoAuthenticationCompleteRequest(
        @NotNull UUID accountId,
        @NotNull UUID txnId,
        @NotBlank String credentialId,
        @NotBlank String authenticatorData,
        @NotBlank String clientDataJSON,
        @NotBlank String signature
) {
}
