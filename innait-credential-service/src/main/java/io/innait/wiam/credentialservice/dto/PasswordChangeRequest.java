package io.innait.wiam.credentialservice.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.util.UUID;

public record PasswordChangeRequest(
        @NotNull UUID accountId,
        @NotBlank String oldPassword,
        @NotBlank String newPassword
) {
}
