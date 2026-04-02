package io.innait.wiam.credentialservice.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.util.UUID;

public record PasswordVerifyRequest(
        @NotNull UUID accountId,
        @NotBlank String password
) {
}
