package io.innait.wiam.policyservice.dto;

import java.util.UUID;

public record AuthPolicyResult(
        String action,
        boolean mfaRequired,
        int requiredAuthLevel,
        UUID matchedPolicyId,
        String matchedPolicyName,
        String matchedRuleExpression
) {}
