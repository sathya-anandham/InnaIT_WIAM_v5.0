package io.innait.wiam.policyservice.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record AuthPolicyCreateRequest(
        @NotBlank String policyName,
        String description,
        int priority,
        @NotBlank String ruleExpression,
        @NotNull String action,
        boolean mfaRequired,
        int requiredAuthLevel,
        boolean isDefault
) {}
