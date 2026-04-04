package io.innait.wiam.credentialservice.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.util.UUID;

public record DeviceAwareFidoRegistrationCompleteRequest(
        @NotNull UUID accountId,
        @NotNull UUID deviceId,
        @NotNull UUID txnId,
        @NotBlank String credentialId,
        @NotBlank String attestationObject,
        @NotBlank String clientDataJSON
) {
}
