package io.innait.wiam.policyservice.dto;

import java.util.UUID;

public record AuthPolicyResponse(
        UUID authPolicyId,
        String policyName,
        String description,
        int priority,
        String ruleExpression,
        String action,
        boolean mfaRequired,
        int requiredAuthLevel,
        boolean isDefault,
        String status
) {}
