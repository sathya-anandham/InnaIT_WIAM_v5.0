package io.innait.wiam.authorchestrator.statemachine;

public enum AuthState {
    INITIATED,
    PRIMARY_CHALLENGE,
    PRIMARY_VERIFIED,
    MFA_CHALLENGE,
    MFA_VERIFIED,
    MAGIC_LINK_SENT,
    ONBOARDING_REQUIRED,
    FIDO_ENROLLMENT_IN_PROGRESS,
    COMPLETED,
    FAILED,
    ABORTED
}
