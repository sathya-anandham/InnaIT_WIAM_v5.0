package io.innait.wiam.apigateway.filter;

import io.innait.wiam.apigateway.config.GatewayProperties;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.cloud.gateway.filter.GatewayFilterChain;
import org.springframework.cloud.gateway.filter.GlobalFilter;
import org.springframework.core.Ordered;
import org.springframework.data.redis.core.ReactiveStringRedisTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.http.server.reactive.ServerHttpRequest;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.time.Duration;

/**
 * Per-IP and per-tenant rate limiting using Redis.
 * Login endpoints: configurable limit (default 10/min).
 * API endpoints: configurable limit (default 100/min).
 * Returns 429 Too Many Requests with Retry-After header when exceeded.
 * Order: 30 (runs after JWT validation).
 */
@Component
public class RateLimitFilter implements GlobalFilter, Ordered {

    private static final Logger log = LoggerFactory.getLogger(RateLimitFilter.class);
    private static final String RATE_LIMIT_KEY_PREFIX = "ratelimit:";
    private static final Duration WINDOW = Duration.ofMinutes(1);

    private final ReactiveStringRedisTemplate redisTemplate;
    private final GatewayProperties properties;

    public RateLimitFilter(ReactiveStringRedisTemplate redisTemplate,
                           GatewayProperties properties) {
        this.redisTemplate = redisTemplate;
        this.properties = properties;
    }

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
        ServerHttpRequest request = exchange.getRequest();
        String path = request.getPath().value();

        // Skip rate limiting for health/swagger
        if (path.startsWith("/actuator") || path.startsWith("/swagger") || path.startsWith("/v3/api-docs")) {
            return chain.filter(exchange);
        }

        String clientIp = extractClientIp(request);
        String tenantId = (String) exchange.getAttributes().get(TenantResolutionFilter.TENANT_ATTR);
        boolean isLoginPath = path.startsWith("/api/v1/auth/login");
        int limit = isLoginPath ? properties.getRateLimit().getLoginPerMinute()
                : properties.getRateLimit().getApiPerMinute();

        String key = buildKey(tenantId, clientIp, isLoginPath);

        return redisTemplate.opsForValue().increment(key)
                .flatMap(count -> {
                    if (count == 1L) {
                        // Set TTL on first request
                        return redisTemplate.expire(key, WINDOW).thenReturn(count);
                    }
                    return Mono.just(count);
                })
                .flatMap(count -> {
                    if (count > limit) {
                        log.warn("Rate limit exceeded: key=[{}] count=[{}] limit=[{}]", key, count, limit);
                        exchange.getResponse().setStatusCode(HttpStatus.TOO_MANY_REQUESTS);
                        exchange.getResponse().getHeaders().add("Retry-After", "60");
                        return exchange.getResponse().setComplete();
                    }
                    return chain.filter(exchange);
                })
                .onErrorResume(e -> {
                    // Graceful degradation: allow request if Redis is down
                    log.warn("Rate limit check failed (allowing request): {}", e.getMessage());
                    return chain.filter(exchange);
                });
    }

    String buildKey(String tenantId, String clientIp, boolean isLogin) {
        String scope = isLogin ? "login" : "api";
        if (tenantId != null) {
            return RATE_LIMIT_KEY_PREFIX + tenantId + ":" + clientIp + ":" + scope;
        }
        return RATE_LIMIT_KEY_PREFIX + clientIp + ":" + scope;
    }

    String extractClientIp(ServerHttpRequest request) {
        // Check X-Forwarded-For header first (behind reverse proxy)
        String xff = request.getHeaders().getFirst("X-Forwarded-For");
        if (xff != null && !xff.isBlank()) {
            return xff.split(",")[0].trim();
        }

        InetSocketAddress remoteAddress = request.getRemoteAddress();
        if (remoteAddress != null) {
            InetAddress address = remoteAddress.getAddress();
            if (address != null) {
                return address.getHostAddress();
            }
        }
        return "unknown";
    }

    @Override
    public int getOrder() {
        return 30;
    }
}
