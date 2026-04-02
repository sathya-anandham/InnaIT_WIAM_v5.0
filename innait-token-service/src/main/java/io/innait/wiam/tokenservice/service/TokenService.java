package io.innait.wiam.tokenservice.service;

import com.nimbusds.jose.*;
import com.nimbusds.jose.crypto.RSASSASigner;
import com.nimbusds.jose.crypto.RSASSAVerifier;
import com.nimbusds.jose.jwk.JWKSet;
import com.nimbusds.jose.jwk.RSAKey;
import com.nimbusds.jwt.JWTClaimsSet;
import com.nimbusds.jwt.SignedJWT;
import io.innait.wiam.common.redis.RedisCacheKeys;
import io.innait.wiam.tokenservice.dto.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.text.ParseException;
import java.time.Duration;
import java.time.Instant;
import java.util.*;

@Service
public class TokenService {

    private final KeyPairHolder keyPairHolder;
    private final StringRedisTemplate redisTemplate;

    @Value("${wiam.token.access-token-ttl-seconds:900}")
    private long accessTokenTtlSeconds; // 15 minutes

    @Value("${wiam.token.issuer:https://auth.innait.io}")
    private String issuer;

    public TokenService(KeyPairHolder keyPairHolder, StringRedisTemplate redisTemplate) {
        this.keyPairHolder = keyPairHolder;
        this.redisTemplate = redisTemplate;
    }

    public TokenIssueResponse issueTokens(TokenIssueRequest request) {
        String accessToken = issueAccessToken(request);
        // Refresh token issuance is delegated to session-service
        return new TokenIssueResponse(accessToken, null, accessTokenTtlSeconds, "Bearer");
    }

    public String issueAccessToken(TokenIssueRequest request) {
        try {
            RSAKey signingKey = keyPairHolder.getActiveSigningKey();
            String kid = signingKey.getKeyID();

            Instant now = Instant.now();
            Instant exp = now.plusSeconds(accessTokenTtlSeconds);

            JWTClaimsSet.Builder claimsBuilder = new JWTClaimsSet.Builder()
                    .issuer(issuer)
                    .subject(request.accountId().toString())
                    .claim("tenant_id", request.tenantId().toString())
                    .claim("user_id", request.accountId().toString())
                    .claim("session_id", request.sessionId().toString())
                    .issueTime(Date.from(now))
                    .expirationTime(Date.from(exp))
                    .jwtID(UUID.randomUUID().toString());

            if (request.loginId() != null) {
                claimsBuilder.claim("login_id", request.loginId());
            }
            if (request.roles() != null && !request.roles().isEmpty()) {
                claimsBuilder.claim("roles", request.roles());
            }
            if (request.groups() != null && !request.groups().isEmpty()) {
                claimsBuilder.claim("groups", request.groups());
            }
            if (request.amr() != null && !request.amr().isEmpty()) {
                claimsBuilder.claim("amr", request.amr());
            }
            if (request.acr() != null) {
                claimsBuilder.claim("acr", request.acr());
            }

            JWTClaimsSet claims = claimsBuilder.build();

            JWSHeader header = new JWSHeader.Builder(JWSAlgorithm.RS256)
                    .keyID(kid)
                    .type(JOSEObjectType.JWT)
                    .build();

            SignedJWT signedJWT = new SignedJWT(header, claims);
            signedJWT.sign(new RSASSASigner(signingKey));

            return signedJWT.serialize();
        } catch (JOSEException e) {
            throw new IllegalStateException("Failed to sign JWT", e);
        }
    }

    public TokenValidationResponse validateToken(String jwt) {
        try {
            SignedJWT signedJWT = SignedJWT.parse(jwt);

            // Get kid from header to find the right key
            String kid = signedJWT.getHeader().getKeyID();
            RSAKey verificationKey = keyPairHolder.findKeyByKid(kid);
            if (verificationKey == null) {
                return inactiveResponse();
            }

            // Verify signature
            if (!signedJWT.verify(new RSASSAVerifier(verificationKey.toRSAPublicKey()))) {
                return inactiveResponse();
            }

            JWTClaimsSet claims = signedJWT.getJWTClaimsSet();

            // Check expiry
            if (claims.getExpirationTime() != null
                    && claims.getExpirationTime().toInstant().isBefore(Instant.now())) {
                return inactiveResponse();
            }

            // Check revocation list in Redis
            String jti = claims.getJWTID();
            if (jti != null && isTokenRevoked(jti)) {
                return inactiveResponse();
            }

            // Parse claims
            UUID accountId = UUID.fromString(claims.getSubject());
            UUID tenantId = parseClaim(claims, "tenant_id");
            UUID sessionId = parseClaim(claims, "session_id");
            String loginId = claims.getStringClaim("login_id");

            @SuppressWarnings("unchecked")
            List<String> roles = (List<String>) claims.getClaim("roles");
            @SuppressWarnings("unchecked")
            List<String> groups = (List<String>) claims.getClaim("groups");
            @SuppressWarnings("unchecked")
            List<String> amr = (List<String>) claims.getClaim("amr");
            String acr = claims.getStringClaim("acr");

            return new TokenValidationResponse(
                    true, accountId, tenantId, sessionId, loginId,
                    roles, groups, amr, acr,
                    claims.getExpirationTime().getTime() / 1000,
                    claims.getIssueTime().getTime() / 1000,
                    claims.getClaims()
            );
        } catch (ParseException | JOSEException e) {
            return inactiveResponse();
        }
    }

    public void revokeToken(String jwt) {
        try {
            SignedJWT signedJWT = SignedJWT.parse(jwt);
            JWTClaimsSet claims = signedJWT.getJWTClaimsSet();
            String jti = claims.getJWTID();
            if (jti != null && claims.getExpirationTime() != null) {
                long ttl = Duration.between(Instant.now(), claims.getExpirationTime().toInstant()).getSeconds();
                if (ttl > 0) {
                    String key = RedisCacheKeys.revokedTokenKey(jti);
                    redisTemplate.opsForValue().set(key, "1", Duration.ofSeconds(ttl));
                }
            }
        } catch (ParseException e) {
            throw new IllegalArgumentException("Invalid JWT", e);
        }
    }

    public JWKSet getJwks() {
        return keyPairHolder.getJwks();
    }

    public void rotateKeys() {
        keyPairHolder.rotateKey();
    }

    private boolean isTokenRevoked(String jti) {
        String key = RedisCacheKeys.revokedTokenKey(jti);
        return Boolean.TRUE.equals(redisTemplate.hasKey(key));
    }

    private UUID parseClaim(JWTClaimsSet claims, String name) {
        try {
            String value = claims.getStringClaim(name);
            return value != null ? UUID.fromString(value) : null;
        } catch (ParseException e) {
            return null;
        }
    }

    private TokenValidationResponse inactiveResponse() {
        return new TokenValidationResponse(false, null, null, null, null,
                null, null, null, null, 0, 0, null);
    }
}
