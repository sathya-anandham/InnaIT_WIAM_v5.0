package io.innait.wiam.credentialservice.dto;

import jakarta.validation.constraints.NotNull;

import java.util.UUID;

public record DeviceAwareFidoRegistrationBeginRequest(
        @NotNull UUID accountId,
        @NotNull UUID deviceId,
        String displayName
) {
}
