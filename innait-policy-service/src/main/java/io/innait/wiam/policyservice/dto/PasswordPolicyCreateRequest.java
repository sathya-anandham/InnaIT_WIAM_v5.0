package io.innait.wiam.policyservice.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;

public record PasswordPolicyCreateRequest(
        @NotBlank String policyName,
        @Min(1) int minLength,
        @Min(1) int maxLength,
        boolean requireUppercase,
        boolean requireLowercase,
        boolean requireDigit,
        boolean requireSpecial,
        int maxRepeatedChars,
        int historyCount,
        int maxAgeDays,
        int minAgeDays,
        int lockoutThreshold,
        int lockoutDurationMin,
        boolean isDefault
) {}
