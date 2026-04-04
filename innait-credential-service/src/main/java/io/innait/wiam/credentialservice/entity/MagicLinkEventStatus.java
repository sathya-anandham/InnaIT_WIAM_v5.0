package io.innait.wiam.credentialservice.entity;

public enum MagicLinkEventStatus {
    SENT,
    VERIFIED,
    FAILED,
    EXPIRED,
    REUSED,
    BLOCKED
}
