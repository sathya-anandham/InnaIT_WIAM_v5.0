package io.innait.wiam.policyservice.dto;

import java.util.UUID;

public record PasswordPolicyResponse(
        UUID passwordPolicyId,
        String policyName,
        int minLength,
        int maxLength,
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
        boolean isDefault,
        String status
) {}
