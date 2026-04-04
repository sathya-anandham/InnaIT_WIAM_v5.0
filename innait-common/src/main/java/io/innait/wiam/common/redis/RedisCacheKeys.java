package io.innait.wiam.common.redis;

import java.util.UUID;

/**
 * Redis key pattern constants following convention: {purpose}:{tenantId}:{identifier}
 */
public final class RedisCacheKeys {

    private RedisCacheKeys() {
    }

    // Prefixes
    public static final String SESSION_PREFIX = "session";
    public static final String AUTH_TXN_PREFIX = "authn:txn";
    public static final String OTP_PREFIX = "otp";
    public static final String RATE_LIMIT_PREFIX = "ratelimit";
    public static final String REVOKED_TOKEN_PREFIX = "revoked";
    public static final String POLICY_PREFIX = "policy";
    public static final String FIDO_CHALLENGE_PREFIX = "fido:challenge";
    public static final String RESET_TOKEN_PREFIX = "reset";
    public static final String ONBOARDING_PREFIX = "onboarding";
    public static final String FORGOT_RATE_LIMIT_PREFIX = "ratelimit:forgot";
    public static final String MAGIC_LINK_PREFIX = "bootstrap:magiclink";
    public static final String BOOTSTRAP_SESSION_PREFIX = "bootstrap:session";

    // TTL defaults (seconds)
    public static final long AUTH_TXN_TTL = 300;          // 5 minutes
    public static final long OTP_TTL_MIN = 60;             // 1 minute
    public static final long OTP_TTL_MAX = 300;            // 5 minutes
    public static final long RATE_LIMIT_TTL = 60;          // 1 minute
    public static final long POLICY_CACHE_TTL = 60;        // 1 minute
    public static final long FIDO_CHALLENGE_TTL = 120;     // 2 minutes
    public static final long RESET_TOKEN_TTL = 900;        // 15 minutes
    public static final long ONBOARDING_TTL = 3600;        // 1 hour
    public static final long FORGOT_RATE_LIMIT_TTL = 900;  // 15 minutes
    public static final long MAGIC_LINK_TTL = 300;         // 5 minutes
    public static final long BOOTSTRAP_SESSION_TTL = 900;  // 15 minutes

    // Key builders

    public static String sessionKey(UUID tenantId, UUID sessionId) {
        return SESSION_PREFIX + ":" + tenantId + ":" + sessionId;
    }

    public static String authTxnKey(UUID txnId) {
        return AUTH_TXN_PREFIX + ":" + txnId;
    }

    public static String otpKey(String type, UUID accountId) {
        return OTP_PREFIX + ":" + type + ":" + accountId;
    }

    public static String rateLimitKey(UUID tenantId, String ip) {
        return RATE_LIMIT_PREFIX + ":" + tenantId + ":" + ip;
    }

    public static String revokedTokenKey(String tokenHash) {
        return REVOKED_TOKEN_PREFIX + ":" + tokenHash;
    }

    public static String policyKey(UUID tenantId, String scope) {
        return POLICY_PREFIX + ":" + tenantId + ":" + scope;
    }

    public static String fidoChallengeKey(UUID txnId) {
        return FIDO_CHALLENGE_PREFIX + ":" + txnId;
    }

    public static String resetTokenKey(String token) {
        return RESET_TOKEN_PREFIX + ":" + token;
    }

    public static String onboardingKey(UUID accountId) {
        return ONBOARDING_PREFIX + ":" + accountId;
    }

    public static String forgotRateLimitKey(String email) {
        return FORGOT_RATE_LIMIT_PREFIX + ":" + email;
    }

    public static String magicLinkKey(UUID txnId) {
        return MAGIC_LINK_PREFIX + ":" + txnId;
    }

    public static String bootstrapSessionKey(UUID sessionId) {
        return BOOTSTRAP_SESSION_PREFIX + ":" + sessionId;
    }
}
