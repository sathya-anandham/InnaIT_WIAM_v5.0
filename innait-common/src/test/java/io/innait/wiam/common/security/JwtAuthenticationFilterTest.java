package io.innait.wiam.common.security;

import com.nimbusds.jose.*;
import com.nimbusds.jose.crypto.RSASSASigner;
import com.nimbusds.jose.jwk.RSAKey;
import com.nimbusds.jose.jwk.gen.RSAKeyGenerator;
import com.nimbusds.jose.proc.SecurityContext;
import com.nimbusds.jwt.JWTClaimsSet;
import com.nimbusds.jwt.SignedJWT;
import com.nimbusds.jwt.proc.ConfigurableJWTProcessor;
import com.nimbusds.jwt.proc.DefaultJWTProcessor;
import jakarta.servlet.FilterChain;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.core.context.SecurityContextHolder;

import jakarta.servlet.http.Cookie;
import java.util.Date;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class JwtAuthenticationFilterTest {

    private JwtAuthenticationFilter filter;
    private RSAKey rsaKey;

    @Mock
    private FilterChain filterChain;

    @BeforeEach
    void setUp() throws Exception {
        rsaKey = new RSAKeyGenerator(2048).keyID("test-key").generate();
        var publicKey = rsaKey.toRSAPublicKey();

        // Build a JWT processor that trusts our test key
        ConfigurableJWTProcessor<SecurityContext> jwtProcessor = new DefaultJWTProcessor<>();
        jwtProcessor.setJWSKeySelector((header, context) -> List.of(publicKey));

        filter = new JwtAuthenticationFilter();
        filter.setJwtProcessor(jwtProcessor);

        SecurityContextHolder.clearContext();
    }

    @Test
    void shouldAuthenticateWithValidBearerToken() throws Exception {
        UUID tenantId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();
        UUID sessionId = UUID.randomUUID();

        String jwt = buildSignedJwt(tenantId, userId, sessionId, new Date(System.currentTimeMillis() + 300_000));

        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader("Authorization", "Bearer " + jwt);
        MockHttpServletResponse response = new MockHttpServletResponse();

        filter.doFilterInternal(request, response, filterChain);

        verify(filterChain).doFilter(request, response);
        var auth = SecurityContextHolder.getContext().getAuthentication();
        assertThat(auth).isInstanceOf(InnaITAuthenticationToken.class);

        InnaITAuthenticationToken token = (InnaITAuthenticationToken) auth;
        assertThat(token.getSubject()).isEqualTo("testuser@innait.io");
        assertThat(token.getTenantId()).isEqualTo(tenantId);
        assertThat(token.getUserId()).isEqualTo(userId);
        assertThat(token.getSessionId()).isEqualTo(sessionId);
        assertThat(token.getRoles()).containsExactly("ADMIN");
        assertThat(token.getGroups()).containsExactly("engineering");
        assertThat(token.isAuthenticated()).isTrue();
    }

    @Test
    void shouldAuthenticateFromCookie() throws Exception {
        UUID tenantId = UUID.randomUUID();
        String jwt = buildSignedJwt(tenantId, UUID.randomUUID(), UUID.randomUUID(),
                new Date(System.currentTimeMillis() + 300_000));

        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setCookies(new Cookie("INNAIT_TOKEN", jwt));
        MockHttpServletResponse response = new MockHttpServletResponse();

        filter.doFilterInternal(request, response, filterChain);

        verify(filterChain).doFilter(request, response);
        var auth = SecurityContextHolder.getContext().getAuthentication();
        assertThat(auth).isInstanceOf(InnaITAuthenticationToken.class);
        assertThat(((InnaITAuthenticationToken) auth).getTenantId()).isEqualTo(tenantId);
    }

    @Test
    void shouldContinueFilterChainWhenNoToken() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest();
        MockHttpServletResponse response = new MockHttpServletResponse();

        filter.doFilterInternal(request, response, filterChain);

        verify(filterChain).doFilter(request, response);
        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
    }

    @Test
    void shouldClearContextForExpiredToken() throws Exception {
        String jwt = buildSignedJwt(UUID.randomUUID(), UUID.randomUUID(), UUID.randomUUID(),
                new Date(System.currentTimeMillis() - 60_000)); // expired 1 minute ago

        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader("Authorization", "Bearer " + jwt);
        MockHttpServletResponse response = new MockHttpServletResponse();

        filter.doFilterInternal(request, response, filterChain);

        verify(filterChain).doFilter(request, response);
        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
    }

    @Test
    void shouldClearContextForTamperedToken() throws Exception {
        String jwt = buildSignedJwt(UUID.randomUUID(), UUID.randomUUID(), UUID.randomUUID(),
                new Date(System.currentTimeMillis() + 300_000));

        // Tamper with the token by modifying payload
        String tampered = jwt.substring(0, jwt.lastIndexOf('.')) + ".invalidsignature";

        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader("Authorization", "Bearer " + tampered);
        MockHttpServletResponse response = new MockHttpServletResponse();

        filter.doFilterInternal(request, response, filterChain);

        verify(filterChain).doFilter(request, response);
        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
    }

    @Test
    void shouldIgnoreNonBearerAuthorizationHeader() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader("Authorization", "Basic dXNlcjpwYXNz");
        MockHttpServletResponse response = new MockHttpServletResponse();

        filter.doFilterInternal(request, response, filterChain);

        verify(filterChain).doFilter(request, response);
        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
    }

    @Test
    void shouldPreferBearerHeaderOverCookie() throws Exception {
        UUID headerTenantId = UUID.randomUUID();
        UUID cookieTenantId = UUID.randomUUID();

        String headerJwt = buildSignedJwt(headerTenantId, UUID.randomUUID(), UUID.randomUUID(),
                new Date(System.currentTimeMillis() + 300_000));
        String cookieJwt = buildSignedJwt(cookieTenantId, UUID.randomUUID(), UUID.randomUUID(),
                new Date(System.currentTimeMillis() + 300_000));

        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader("Authorization", "Bearer " + headerJwt);
        request.setCookies(new Cookie("INNAIT_TOKEN", cookieJwt));
        MockHttpServletResponse response = new MockHttpServletResponse();

        filter.doFilterInternal(request, response, filterChain);

        var auth = (InnaITAuthenticationToken) SecurityContextHolder.getContext().getAuthentication();
        assertThat(auth.getTenantId()).isEqualTo(headerTenantId);
    }

    private String buildSignedJwt(UUID tenantId, UUID userId, UUID sessionId, Date expirationTime)
            throws JOSEException {
        JWTClaimsSet claims = new JWTClaimsSet.Builder()
                .subject("testuser@innait.io")
                .claim("tenant_id", tenantId.toString())
                .claim("user_id", userId.toString())
                .claim("login_id", "testuser")
                .claim("session_id", sessionId.toString())
                .claim("roles", List.of("ADMIN"))
                .claim("groups", List.of("engineering"))
                .claim("amr", List.of("pwd"))
                .claim("acr", "aal1")
                .issueTime(new Date())
                .expirationTime(expirationTime)
                .build();

        SignedJWT signedJWT = new SignedJWT(
                new JWSHeader.Builder(JWSAlgorithm.RS256).keyID(rsaKey.getKeyID()).build(),
                claims
        );
        signedJWT.sign(new RSASSASigner(rsaKey));
        return signedJWT.serialize();
    }
}
