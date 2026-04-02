package io.innait.wiam.adminbff.dto;

import jakarta.validation.constraints.NotBlank;

public record OnboardingEnrollMfaRequest(
        @NotBlank String mfaType,
        String verificationCode
) {}
