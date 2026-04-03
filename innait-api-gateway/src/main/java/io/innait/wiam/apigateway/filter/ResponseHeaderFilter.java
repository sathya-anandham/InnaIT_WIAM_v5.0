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
 * Uses beforeCommit to add headers before the response is committed (Netty flushes headers
 * before the Mono chain's then() runs, so .then(fromRunnable) on a committed response throws
 * UnsupportedOperationException). The then(fromRunnable).onErrorResume fallback handles
 * MockServerHttpResponse in unit tests where no actual commit ever occurs.
 * Order: -1 (runs early, wraps the rest of the filter chain).
 */
@Component
public class ResponseHeaderFilter implements GlobalFilter, Ordered {

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
        String path = exchange.getRequest().getPath().value();

        // beforeCommit runs before the response is committed (works in production with Netty).
        exchange.getResponse().beforeCommit(() -> {
            applyHeaders(exchange.getResponse().getHeaders(), path);
            return Mono.<Void>empty();
        });

        // then(fromRunnable) handles MockServerHttpResponse in unit tests (state=NEW, mutable).
        // onErrorResume suppresses UnsupportedOperationException when response is already committed.
        return chain.filter(exchange)
                .then(Mono.<Void>fromRunnable(() -> applyHeaders(exchange.getResponse().getHeaders(), path)))
                .onErrorResume(UnsupportedOperationException.class, e -> Mono.<Void>empty());
    }

    private void applyHeaders(HttpHeaders headers, String path) {
        headers.remove("Server");
        headers.remove("X-Powered-By");
        headers.addIfAbsent("X-Content-Type-Options", "nosniff");
        headers.addIfAbsent("X-Frame-Options", "DENY");
        headers.addIfAbsent("X-XSS-Protection", "1; mode=block");
        headers.addIfAbsent("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
        if (path.startsWith("/api/")) {
            headers.addIfAbsent("Cache-Control", "no-store");
            headers.addIfAbsent("Pragma", "no-cache");
        }
    }

    @Override
    public int getOrder() {
        return -1;
    }
}
