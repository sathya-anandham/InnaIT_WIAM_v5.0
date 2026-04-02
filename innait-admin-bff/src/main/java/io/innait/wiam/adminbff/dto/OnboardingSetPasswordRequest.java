package io.innait.wiam.adminbff.dto;

import jakarta.validation.constraints.NotBlank;

public record OnboardingSetPasswordRequest(
        @NotBlank String newPassword
) {}
