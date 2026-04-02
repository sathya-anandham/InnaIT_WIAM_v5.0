package io.innait.wiam.apigateway.filter;

import com.nimbusds.jose.JWSAlgorithm;
import com.nimbusds.jose.jwk.source.JWKSource;
import com.nimbusds.jose.jwk.source.JWKSourceBuilder;
import com.nimbusds.jose.proc.JWSKeySelector;
import com.nimbusds.jose.proc.JWSVerificationKeySelector;
import com.nimbusds.jose.proc.SecurityContext;
import com.nimbusds.jwt.JWTClaimsSet;
import com.nimbusds.jwt.proc.ConfigurableJWTProcessor;
import com.nimbusds.jwt.proc.DefaultJWTProcessor;
import io.innait.wiam.apigateway.config.GatewayProperties;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.cloud.gateway.filter.GatewayFilterChain;
import org.springframework.cloud.gateway.filter.GlobalFilter;
import org.springframework.core.Ordered;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.server.reactive.ServerHttpRequest;
import org.springframework.stereotype.Component;
import org.springframework.util.AntPathMatcher;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

import java.net.URI;
import java.util.List;

/**
 * Validates JWT tokens from the Authorization header via JWKS endpoint.
 * Extracts claims and adds them as headers: X-User-ID, X-Account-ID, X-Tenant-ID, X-Roles.
 * Skips public endpoints.
 * Order: 20 (runs after TenantResolutionFilter).
 */
@Component
public class JwtValidationFilter implements GlobalFilter, Ordered {

    private static final Logger log = LoggerFactory.getLogger(JwtValidationFilter.class);
    private static final String BEARER_PREFIX = "Bearer ";

    private final GatewayProperties properties;
    private final AntPathMatcher pathMatcher = new AntPathMatcher();
    private ConfigurableJWTProcessor<SecurityContext> jwtProcessor;

    public JwtValidationFilter(GatewayProperties properties) {
        this.properties = properties;
    }

    @PostConstruct
    void init() {
        try {
            JWKSource<SecurityContext> keySource = JWKSourceBuilder
                    .create(URI.create(properties.getJwt().getJwksUrl()).toURL())
                    .cache(true)
                    .build();

            JWSKeySelector<SecurityContext> keySelector = new JWSVerificationKeySelector<>(
                    JWSAlgorithm.RS256, keySource);

            jwtProcessor = new DefaultJWTProcessor<>();
            jwtProcessor.setJWSKeySelector(keySelector);
            log.info("JWT processor initialized with JWKS URL: {}", properties.getJwt().getJwksUrl());
        } catch (Exception e) {
            log.warn("JWKS initialization deferred: {}", e.getMessage());
        }
    }

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
        String path = exchange.getRequest().getPath().value();

        // Skip public paths
        if (isPublicPath(path)) {
            return chain.filter(exchange);
        }

        String authHeader = exchange.getRequest().getHeaders().getFirst(HttpHeaders.AUTHORIZATION);
        if (authHeader == null || !authHeader.startsWith(BEARER_PREFIX)) {
            exchange.getResponse().setStatusCode(HttpStatus.UNAUTHORIZED);
            return exchange.getResponse().setComplete();
        }

        String token = authHeader.substring(BEARER_PREFIX.length());

        try {
            JWTClaimsSet claims = validateToken(token);

            // Extract claims and add as downstream headers
            ServerHttpRequest mutatedRequest = exchange.getRequest().mutate()
                    .header("X-User-ID", getClaimString(claims, "user_id"))
                    .header("X-Account-ID", getClaimString(claims, "account_id"))
                    .header("X-Tenant-ID", getClaimString(claims, "tenant_id"))
                    .header("X-Roles", String.join(",", getClaimStringList(claims, "roles")))
                    .build();

            return chain.filter(exchange.mutate().request(mutatedRequest).build());
        } catch (Exception e) {
            log.warn("JWT validation failed: {}", e.getMessage());
            exchange.getResponse().setStatusCode(HttpStatus.UNAUTHORIZED);
            return exchange.getResponse().setComplete();
        }
    }

    JWTClaimsSet validateToken(String token) throws Exception {
        if (jwtProcessor == null) {
            throw new IllegalStateException("JWT processor not initialized");
        }
        return jwtProcessor.process(token, null);
    }

    boolean isPublicPath(String path) {
        for (String pattern : properties.getPublicPaths()) {
            if (pathMatcher.match(pattern, path)) {
                return true;
            }
        }
        return false;
    }

    private String getClaimString(JWTClaimsSet claims, String key) {
        Object val = claims.getClaim(key);
        return val != null ? val.toString() : "";
    }

    @SuppressWarnings("unchecked")
    private List<String> getClaimStringList(JWTClaimsSet claims, String key) {
        Object val = claims.getClaim(key);
        if (val instanceof List<?> list) {
            return list.stream().map(Object::toString).toList();
        }
        return List.of();
    }

    @Override
    public int getOrder() {
        return 20;
    }
}
