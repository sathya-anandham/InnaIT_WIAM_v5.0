package io.innait.wiam.common.security;

import com.nimbusds.jose.JOSEException;
import com.nimbusds.jose.JWSAlgorithm;
import com.nimbusds.jose.jwk.source.JWKSource;
import com.nimbusds.jose.jwk.source.JWKSourceBuilder;
import com.nimbusds.jose.proc.BadJOSEException;
import com.nimbusds.jose.proc.JWSKeySelector;
import com.nimbusds.jose.proc.JWSVerificationKeySelector;
import com.nimbusds.jose.proc.SecurityContext;
import com.nimbusds.jwt.JWTClaimsSet;
import com.nimbusds.jwt.proc.ConfigurableJWTProcessor;
import com.nimbusds.jwt.proc.DefaultJWTProcessor;
import jakarta.annotation.PostConstruct;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.net.URL;
import java.text.ParseException;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Component
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private static final Logger log = LoggerFactory.getLogger(JwtAuthenticationFilter.class);
    private static final String AUTHORIZATION_HEADER = "Authorization";
    private static final String BEARER_PREFIX = "Bearer ";
    private static final String COOKIE_NAME = "INNAIT_TOKEN";

    @Value("${innait.security.jwks-url:http://localhost:8086/.well-known/jwks.json}")
    private String jwksUrl;

    private ConfigurableJWTProcessor<SecurityContext> jwtProcessor;

    @PostConstruct
    void init() throws Exception {
        JWKSource<SecurityContext> keySource = JWKSourceBuilder
                .create(new URL(jwksUrl))
                .retrying(true)
                .build();
        JWSKeySelector<SecurityContext> keySelector =
                new JWSVerificationKeySelector<>(JWSAlgorithm.RS256, keySource);

        jwtProcessor = new DefaultJWTProcessor<>();
        jwtProcessor.setJWSKeySelector(keySelector);
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        String token = extractToken(request);
        if (token != null) {
            try {
                JWTClaimsSet claims = jwtProcessor.process(token, null);
                InnaITAuthenticationToken authentication = buildAuthentication(claims, token);
                SecurityContextHolder.getContext().setAuthentication(authentication);
            } catch (ParseException | BadJOSEException | JOSEException e) {
                log.debug("JWT validation failed: {}", e.getMessage());
                SecurityContextHolder.clearContext();
            }
        }
        filterChain.doFilter(request, response);
    }

    private String extractToken(HttpServletRequest request) {
        String authHeader = request.getHeader(AUTHORIZATION_HEADER);
        if (authHeader != null && authHeader.startsWith(BEARER_PREFIX)) {
            return authHeader.substring(BEARER_PREFIX.length());
        }
        if (request.getCookies() != null) {
            for (Cookie cookie : request.getCookies()) {
                if (COOKIE_NAME.equals(cookie.getName())) {
                    return cookie.getValue();
                }
            }
        }
        return null;
    }

    @SuppressWarnings("unchecked")
    private InnaITAuthenticationToken buildAuthentication(JWTClaimsSet claims, String rawToken)
            throws ParseException {
        String subject = claims.getSubject();
        UUID tenantId = parseUUID(claims.getStringClaim("tenant_id"));
        UUID userId = parseUUID(claims.getStringClaim("user_id"));
        String loginId = claims.getStringClaim("login_id");
        UUID sessionId = parseUUID(claims.getStringClaim("session_id"));

        List<String> roles = getStringListClaim(claims, "roles");
        List<String> groups = getStringListClaim(claims, "groups");
        List<String> amr = getStringListClaim(claims, "amr");
        String acr = claims.getStringClaim("acr");

        List<SimpleGrantedAuthority> authorities = new ArrayList<>();
        for (String role : roles) {
            authorities.add(new SimpleGrantedAuthority("ROLE_" + role));
        }

        return new InnaITAuthenticationToken(
                subject, tenantId, userId, loginId, sessionId,
                roles, groups, amr, acr, rawToken, authorities
        );
    }

    private UUID parseUUID(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return UUID.fromString(value);
    }

    @SuppressWarnings("unchecked")
    private List<String> getStringListClaim(JWTClaimsSet claims, String name) throws ParseException {
        Object value = claims.getClaim(name);
        if (value instanceof List<?> list) {
            return list.stream()
                    .filter(String.class::isInstance)
                    .map(String.class::cast)
                    .toList();
        }
        return List.of();
    }

    // Visible for testing
    void setJwtProcessor(ConfigurableJWTProcessor<SecurityContext> jwtProcessor) {
        this.jwtProcessor = jwtProcessor;
    }
}
