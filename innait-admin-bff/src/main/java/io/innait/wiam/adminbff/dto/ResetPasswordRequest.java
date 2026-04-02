package io.innait.wiam.adminbff.dto;

import jakarta.validation.constraints.NotBlank;

public record ResetPasswordRequest(
        @NotBlank String resetToken,
        @NotBlank String newPassword
) {}
