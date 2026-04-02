package io.innait.wiam.credentialservice.dto;

import jakarta.validation.constraints.NotBlank;

public record SoftTokenActivateRequest(
        @NotBlank String deviceId,
        @NotBlank String activationCode,
        String pushToken
) {
}
