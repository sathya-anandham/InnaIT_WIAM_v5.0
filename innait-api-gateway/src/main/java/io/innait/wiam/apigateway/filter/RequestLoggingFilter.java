package io.innait.wiam.apigateway.filter;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.cloud.gateway.filter.GatewayFilterChain;
import org.springframework.cloud.gateway.filter.GlobalFilter;
import org.springframework.core.Ordered;
import org.springframework.http.server.reactive.ServerHttpRequest;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

/**
 * Logs request/response: method, path, tenant, accountId, status, latency.
 * Excludes sensitive paths from detailed logging.
 * Order: 1 (runs very early, wraps the full chain).
 */
@Component
public class RequestLoggingFilter implements GlobalFilter, Ordered {

    private static final Logger log = LoggerFactory.getLogger(RequestLoggingFilter.class);

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
        long startTime = System.currentTimeMillis();
        ServerHttpRequest request = exchange.getRequest();
        String method = request.getMethod().name();
        String path = request.getPath().value();

        return chain.filter(exchange).then(Mono.fromRunnable(() -> {
            long latency = System.currentTimeMillis() - startTime;
            String tenantId = (String) exchange.getAttributes().get(TenantResolutionFilter.TENANT_ATTR);
            String accountId = exchange.getRequest().getHeaders().getFirst("X-Account-ID");
            int status = exchange.getResponse().getStatusCode() != null
                    ? exchange.getResponse().getStatusCode().value() : 0;

            if (isSensitivePath(path)) {
                log.info("GW {} {} tenant=[{}] status=[{}] latency=[{}ms]",
                        method, path, tenantId, status, latency);
            } else {
                log.info("GW {} {} tenant=[{}] account=[{}] status=[{}] latency=[{}ms]",
                        method, path, tenantId, accountId, status, latency);
            }
        }));
    }

    private boolean isSensitivePath(String path) {
        return path.contains("/login") || path.contains("/token") || path.contains("/credential");
    }

    @Override
    public int getOrder() {
        return 1;
    }
}
