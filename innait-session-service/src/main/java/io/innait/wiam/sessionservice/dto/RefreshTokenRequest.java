package io.innait.wiam.sessionservice.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.util.UUID;

public record RefreshTokenRequest(
        @NotNull UUID sessionId,
        @NotBlank String refreshToken
) {}
