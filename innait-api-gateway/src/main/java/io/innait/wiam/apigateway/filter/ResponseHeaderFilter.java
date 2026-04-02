package io.innait.wiam.apigateway.filter;

import org.springframework.cloud.gateway.filter.GatewayFilterChain;
import org.springframework.cloud.gateway.filter.GlobalFilter;
import org.springframework.core.Ordered;
import org.springframework.http.HttpHeaders;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

/**
 * Post-filter that removes server version headers and adds security headers.
 * Order: -1 (runs late, after downstream response is received).
 */
@Component
public class ResponseHeaderFilter implements GlobalFilter, Ordered {

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
        return chain.filter(exchange).then(Mono.fromRunnable(() -> {
            HttpHeaders headers = exchange.getResponse().getHeaders();

            // Remove server version headers
            headers.remove("Server");
            headers.remove("X-Powered-By");

            // Security headers
            headers.addIfAbsent("X-Content-Type-Options", "nosniff");
            headers.addIfAbsent("X-Frame-Options", "DENY");
            headers.addIfAbsent("X-XSS-Protection", "1; mode=block");
            headers.addIfAbsent("Strict-Transport-Security", "max-age=31536000; includeSubDomains");

            // Cache control for API responses
            String path = exchange.getRequest().getPath().value();
            if (path.startsWith("/api/")) {
                headers.addIfAbsent("Cache-Control", "no-store");
                headers.addIfAbsent("Pragma", "no-cache");
            }
        }));
    }

    @Override
    public int getOrder() {
        return -1;
    }
}
