package io.innait.wiam.authorchestrator.statemachine;

public enum AuthState {
    INITIATED,
    PRIMARY_CHALLENGE,
    PRIMARY_VERIFIED,
    MFA_CHALLENGE,
    MFA_VERIFIED,
    COMPLETED,
    FAILED,
    ABORTED
}
