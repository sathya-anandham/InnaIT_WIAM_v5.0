package io.innait.wiam.tokenservice.service;

import com.nimbusds.jose.jwk.JWKSet;
import com.nimbusds.jose.jwk.RSAKey;
import com.nimbusds.jwt.SignedJWT;
import io.innait.wiam.tokenservice.dto.TokenIssueRequest;
import io.innait.wiam.tokenservice.dto.TokenIssueResponse;
import io.innait.wiam.tokenservice.dto.TokenValidationResponse;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;

import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.interfaces.RSAPrivateKey;
import java.security.interfaces.RSAPublicKey;
import java.text.ParseException;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class TokenServiceTest {

    @Mock private StringRedisTemplate redisTemplate;
    @Mock private ValueOperations<String, String> valueOps;

    private TokenService tokenService;
    private KeyPairHolder keyPairHolder;

    @BeforeEach
    void setUp() throws Exception {
        keyPairHolder = new KeyPairHolder(86400L);
        tokenService = new TokenService(keyPairHolder, redisTemplate);

        // Set config via reflection
        setField(tokenService, "accessTokenTtlSeconds", 900L);
        setField(tokenService, "issuer", "https://auth.innait.io");
    }

    @Nested
    class IssueAccessToken {

        @Test
        void shouldIssueValidJwt() throws ParseException {
            TokenIssueRequest request = createRequest();
            TokenIssueResponse response = tokenService.issueTokens(request);

            assertThat(response.accessToken()).isNotNull();
            assertThat(response.tokenType()).isEqualTo("Bearer");
            assertThat(response.expiresIn()).isEqualTo(900L);

            // Parse and verify structure
            SignedJWT jwt = SignedJWT.parse(response.accessToken());
            assertThat(jwt.getHeader().getKeyID()).isEqualTo(keyPairHolder.getActiveKid());
            assertThat(jwt.getHeader().getAlgorithm().getName()).isEqualTo("RS256");
        }

        @Test
        void shouldIncludeCorrectClaims() throws ParseException {
            UUID accountId = UUID.randomUUID();
            UUID tenantId = UUID.randomUUID();
            UUID sessionId = UUID.randomUUID();

            TokenIssueRequest request = new TokenIssueRequest(
                    sessionId, accountId, tenantId, "john.doe",
                    List.of("ADMIN", "USER"), List.of("engineering"),
                    List.of("pwd", "totp"), "urn:innait:acr:mfa");

            String jwt = tokenService.issueAccessToken(request);
            SignedJWT parsed = SignedJWT.parse(jwt);
            var claims = parsed.getJWTClaimsSet();

            assertThat(claims.getSubject()).isEqualTo(accountId.toString());
            assertThat(claims.getStringClaim("tenant_id")).isEqualTo(tenantId.toString());
            assertThat(claims.getStringClaim("session_id")).isEqualTo(sessionId.toString());
            assertThat(claims.getStringClaim("login_id")).isEqualTo("john.doe");
            assertThat(claims.getStringListClaim("roles")).containsExactly("ADMIN", "USER");
            assertThat(claims.getStringListClaim("groups")).containsExactly("engineering");
            assertThat(claims.getStringListClaim("amr")).containsExactly("pwd", "totp");
            assertThat(claims.getStringClaim("acr")).isEqualTo("urn:innait:acr:mfa");
            assertThat(claims.getIssuer()).isEqualTo("https://auth.innait.io");
            assertThat(claims.getJWTID()).isNotNull();
        }

        @Test
        void shouldSetCorrectExpiry() throws ParseException {
            TokenIssueRequest request = createRequest();
            String jwt = tokenService.issueAccessToken(request);
            SignedJWT parsed = SignedJWT.parse(jwt);
            var claims = parsed.getJWTClaimsSet();

            long expSeconds = claims.getExpirationTime().getTime() / 1000;
            long iatSeconds = claims.getIssueTime().getTime() / 1000;
            assertThat(expSeconds - iatSeconds).isEqualTo(900L);
        }

        @Test
        void shouldUseActiveKidInHeader() throws ParseException {
            String kid = keyPairHolder.getActiveKid();
            TokenIssueRequest request = createRequest();
            String jwt = tokenService.issueAccessToken(request);
            SignedJWT parsed = SignedJWT.parse(jwt);

            assertThat(parsed.getHeader().getKeyID()).isEqualTo(kid);
        }

        @Test
        void shouldOmitNullClaims() throws ParseException {
            TokenIssueRequest request = new TokenIssueRequest(
                    UUID.randomUUID(), UUID.randomUUID(), UUID.randomUUID(),
                    null, null, null, null, null);

            String jwt = tokenService.issueAccessToken(request);
            SignedJWT parsed = SignedJWT.parse(jwt);
            var claims = parsed.getJWTClaimsSet();

            assertThat(claims.getClaim("login_id")).isNull();
            assertThat(claims.getClaim("roles")).isNull();
            assertThat(claims.getClaim("groups")).isNull();
            assertThat(claims.getClaim("amr")).isNull();
            assertThat(claims.getClaim("acr")).isNull();
        }

        @Test
        void shouldGenerateUniqueJtiForEachToken() throws ParseException {
            TokenIssueRequest request = createRequest();
            String jwt1 = tokenService.issueAccessToken(request);
            String jwt2 = tokenService.issueAccessToken(request);

            String jti1 = SignedJWT.parse(jwt1).getJWTClaimsSet().getJWTID();
            String jti2 = SignedJWT.parse(jwt2).getJWTClaimsSet().getJWTID();
            assertThat(jti1).isNotEqualTo(jti2);
        }
    }

    @Nested
    class ValidateToken {

        @Test
        void shouldValidateValidToken() {
            lenient().when(redisTemplate.hasKey(anyString())).thenReturn(false);
            TokenIssueRequest request = createRequest();
            String jwt = tokenService.issueAccessToken(request);

            TokenValidationResponse response = tokenService.validateToken(jwt);

            assertThat(response.active()).isTrue();
            assertThat(response.accountId()).isEqualTo(request.accountId());
            assertThat(response.tenantId()).isEqualTo(request.tenantId());
            assertThat(response.sessionId()).isEqualTo(request.sessionId());
        }

        @Test
        void shouldRejectTamperedToken() {
            TokenIssueRequest request = createRequest();
            String jwt = tokenService.issueAccessToken(request);
            // Tamper with the signature
            String tampered = jwt.substring(0, jwt.lastIndexOf('.') + 1) + "invalid-sig";

            TokenValidationResponse response = tokenService.validateToken(tampered);
            assertThat(response.active()).isFalse();
        }

        @Test
        void shouldRejectTokenWithUnknownKid() throws Exception {
            // Create a token signed with a different key
            KeyPairGenerator gen = KeyPairGenerator.getInstance("RSA");
            gen.initialize(2048);
            KeyPair kp = gen.generateKeyPair();
            RSAKey otherKey = new RSAKey.Builder((RSAPublicKey) kp.getPublic())
                    .privateKey((RSAPrivateKey) kp.getPrivate())
                    .keyID("unknown-kid")
                    .build();
            KeyPairHolder otherHolder = new KeyPairHolder(otherKey, 86400);
            TokenService otherService = new TokenService(otherHolder, redisTemplate);
            setField(otherService, "accessTokenTtlSeconds", 900L);
            setField(otherService, "issuer", "https://auth.innait.io");

            String jwt = otherService.issueAccessToken(createRequest());

            TokenValidationResponse response = tokenService.validateToken(jwt);
            assertThat(response.active()).isFalse();
        }

        @Test
        void shouldRejectRevokedToken() {
            when(redisTemplate.hasKey(anyString())).thenReturn(true); // Token is revoked

            TokenIssueRequest request = createRequest();
            String jwt = tokenService.issueAccessToken(request);

            TokenValidationResponse response = tokenService.validateToken(jwt);
            assertThat(response.active()).isFalse();
        }

        @Test
        void shouldRejectMalformedJwt() {
            TokenValidationResponse response = tokenService.validateToken("not.a.jwt");
            assertThat(response.active()).isFalse();
        }

        @Test
        void shouldReturnClaimsOnValidToken() {
            lenient().when(redisTemplate.hasKey(anyString())).thenReturn(false);
            TokenIssueRequest request = new TokenIssueRequest(
                    UUID.randomUUID(), UUID.randomUUID(), UUID.randomUUID(),
                    "jane", List.of("ADMIN"), List.of("devs"),
                    List.of("pwd"), "urn:innait:acr:pwd");

            String jwt = tokenService.issueAccessToken(request);
            TokenValidationResponse response = tokenService.validateToken(jwt);

            assertThat(response.loginId()).isEqualTo("jane");
            assertThat(response.roles()).containsExactly("ADMIN");
            assertThat(response.groups()).containsExactly("devs");
            assertThat(response.amr()).containsExactly("pwd");
            assertThat(response.acr()).isEqualTo("urn:innait:acr:pwd");
            assertThat(response.exp()).isGreaterThan(0);
            assertThat(response.iat()).isGreaterThan(0);
        }
    }

    @Nested
    class RevokeToken {

        @Test
        void shouldStoreRevokedTokenInRedis() {
            lenient().when(redisTemplate.opsForValue()).thenReturn(valueOps);
            TokenIssueRequest request = createRequest();
            String jwt = tokenService.issueAccessToken(request);

            tokenService.revokeToken(jwt);

            verify(valueOps).set(anyString(), eq("1"), any(java.time.Duration.class));
        }

        @Test
        void shouldRejectInvalidJwtForRevocation() {
            assertThatThrownBy(() -> tokenService.revokeToken("invalid"))
                    .isInstanceOf(IllegalArgumentException.class);
        }
    }

    @Nested
    class KeyRotation {

        @Test
        void shouldRotateKeysSuccessfully() {
            String oldKid = keyPairHolder.getActiveKid();
            tokenService.rotateKeys();
            String newKid = keyPairHolder.getActiveKid();

            assertThat(newKid).isNotEqualTo(oldKid);
        }

        @Test
        void shouldValidateTokenSignedWithOldKeyAfterRotation() {
            lenient().when(redisTemplate.hasKey(anyString())).thenReturn(false);
            TokenIssueRequest request = createRequest();
            String jwt = tokenService.issueAccessToken(request);

            tokenService.rotateKeys();

            // Old token should still validate (key overlap)
            TokenValidationResponse response = tokenService.validateToken(jwt);
            assertThat(response.active()).isTrue();
        }

        @Test
        void shouldSignNewTokensWithNewKeyAfterRotation() throws ParseException {
            String oldKid = keyPairHolder.getActiveKid();
            tokenService.rotateKeys();

            String jwt = tokenService.issueAccessToken(createRequest());
            SignedJWT parsed = SignedJWT.parse(jwt);

            assertThat(parsed.getHeader().getKeyID()).isNotEqualTo(oldKid);
            assertThat(parsed.getHeader().getKeyID()).isEqualTo(keyPairHolder.getActiveKid());
        }
    }

    @Nested
    class Jwks {

        @Test
        void shouldReturnActiveKeyInJwks() {
            JWKSet jwks = tokenService.getJwks();
            assertThat(jwks.getKeys()).hasSize(1);
            assertThat(jwks.getKeys().get(0).getKeyID()).isEqualTo(keyPairHolder.getActiveKid());
        }

        @Test
        void shouldReturnBothKeysAfterRotation() {
            String oldKid = keyPairHolder.getActiveKid();
            tokenService.rotateKeys();

            JWKSet jwks = tokenService.getJwks();
            assertThat(jwks.getKeys()).hasSize(2);
            List<String> kids = jwks.getKeys().stream().map(k -> k.getKeyID()).toList();
            assertThat(kids).contains(oldKid, keyPairHolder.getActiveKid());
        }

        @Test
        void shouldOnlyContainPublicKeys() {
            JWKSet jwks = tokenService.getJwks();
            for (var key : jwks.getKeys()) {
                RSAKey rsaKey = (RSAKey) key;
                assertThat(rsaKey.isPrivate()).isFalse();
            }
        }
    }

    @Nested
    class KeyPairHolderTests {

        @Test
        void shouldFindActiveKeyByKid() {
            RSAKey found = keyPairHolder.findKeyByKid(keyPairHolder.getActiveKid());
            assertThat(found).isNotNull();
        }

        @Test
        void shouldReturnNullForUnknownKid() {
            RSAKey found = keyPairHolder.findKeyByKid("non-existent");
            assertThat(found).isNull();
        }

        @Test
        void shouldFindPreviousKeyAfterRotation() {
            String oldKid = keyPairHolder.getActiveKid();
            keyPairHolder.rotateKey();

            RSAKey found = keyPairHolder.findKeyByKid(oldKid);
            assertThat(found).isNotNull();
        }
    }

    // ---- Helpers ----

    private TokenIssueRequest createRequest() {
        return new TokenIssueRequest(
                UUID.randomUUID(), UUID.randomUUID(), UUID.randomUUID(),
                "testuser", List.of("USER"), List.of("default"),
                List.of("pwd"), "urn:innait:acr:pwd");
    }

    private void setField(Object target, String fieldName, Object value) {
        try {
            var field = target.getClass().getDeclaredField(fieldName);
            field.setAccessible(true);
            field.set(target, value);
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }
}
