package io.innait.wiam.credentialservice.dto;

import jakarta.validation.constraints.NotNull;

import java.util.UUID;

public record SoftTokenProvisionRequest(
        @NotNull UUID accountId,
        @NotNull String devicePlatform,
        String deviceName
) {
}
