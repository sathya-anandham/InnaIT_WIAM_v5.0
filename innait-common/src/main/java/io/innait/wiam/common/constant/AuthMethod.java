package io.innait.wiam.common.constant;

public enum AuthMethod {
    PASSWORD,
    WEBAUTHN,
    OTP_EMAIL,
    OTP_SMS,
    TOTP,
    PUSH,
    MAGIC_LINK,
    SSO_SAML,
    SSO_OIDC,
    CERTIFICATE,
    KERBEROS
}
