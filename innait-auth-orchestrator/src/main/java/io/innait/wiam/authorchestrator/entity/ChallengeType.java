package io.innait.wiam.authorchestrator.entity;

public enum ChallengeType {
    PASSWORD,
    FIDO,
    TOTP,
    OTP_EMAIL,
    OTP_SMS,
    PUSH,
    MAGIC_LINK
}
