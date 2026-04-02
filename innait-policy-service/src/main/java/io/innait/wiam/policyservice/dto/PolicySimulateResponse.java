package io.innait.wiam.policyservice.dto;

public record PolicySimulateResponse(
        PasswordPolicyResponse resolvedPasswordPolicy,
        MfaPolicyResponse resolvedMfaPolicy,
        AuthPolicyResult resolvedAuthPolicy
) {}
