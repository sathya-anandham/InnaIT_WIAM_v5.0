package io.innait.wiam.common.redis;

import org.junit.jupiter.api.Test;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class RedisCacheKeysTest {

    @Test
    void sessionKeyShouldFollowPattern() {
        UUID tenantId = UUID.randomUUID();
        UUID sessionId = UUID.randomUUID();

        String key = RedisCacheKeys.sessionKey(tenantId, sessionId);

        assertThat(key).isEqualTo("session:" + tenantId + ":" + sessionId);
    }

    @Test
    void authTxnKeyShouldFollowPattern() {
        UUID txnId = UUID.randomUUID();

        String key = RedisCacheKeys.authTxnKey(txnId);

        assertThat(key).isEqualTo("authn:txn:" + txnId);
    }

    @Test
    void otpKeyShouldIncludeTypeAndAccountId() {
        UUID accountId = UUID.randomUUID();

        String key = RedisCacheKeys.otpKey("email", accountId);

        assertThat(key).isEqualTo("otp:email:" + accountId);
    }

    @Test
    void rateLimitKeyShouldIncludeTenantAndIp() {
        UUID tenantId = UUID.randomUUID();

        String key = RedisCacheKeys.rateLimitKey(tenantId, "192.168.1.1");

        assertThat(key).isEqualTo("ratelimit:" + tenantId + ":192.168.1.1");
    }

    @Test
    void revokedTokenKeyShouldIncludeHash() {
        String key = RedisCacheKeys.revokedTokenKey("abc123hash");

        assertThat(key).isEqualTo("revoked:abc123hash");
    }

    @Test
    void policyKeyShouldIncludeTenantAndScope() {
        UUID tenantId = UUID.randomUUID();

        String key = RedisCacheKeys.policyKey(tenantId, "password");

        assertThat(key).isEqualTo("policy:" + tenantId + ":password");
    }

    @Test
    void fidoChallengeKeyShouldFollowPattern() {
        UUID txnId = UUID.randomUUID();

        String key = RedisCacheKeys.fidoChallengeKey(txnId);

        assertThat(key).isEqualTo("fido:challenge:" + txnId);
    }
}
