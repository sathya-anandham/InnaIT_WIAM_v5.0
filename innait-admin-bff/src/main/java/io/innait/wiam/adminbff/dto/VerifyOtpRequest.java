package io.innait.wiam.adminbff.dto;

import jakarta.validation.constraints.NotBlank;

public record VerifyOtpRequest(
        @NotBlank String email,
        @NotBlank String otp
) {}
