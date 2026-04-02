package io.innait.wiam.tokenservice.dto;

import jakarta.validation.constraints.NotBlank;

public record TokenRevokeRequest(
        @NotBlank String token,
        String tokenTypeHint
) {}
