package io.innait.wiam.apigateway.filter;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.cloud.gateway.filter.GatewayFilterChain;
import org.springframework.cloud.gateway.filter.GlobalFilter;
import org.springframework.core.Ordered;
import org.springframework.http.HttpStatus;
import org.springframework.http.server.reactive.ServerHttpRequest;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

import java.net.InetSocketAddress;

/**
 * Extracts tenant from subdomain ({tenant}.api.innait.io) or X-Tenant-ID header.
 * Adds X-Tenant-ID header to downstream request.
 * Order: 10 (runs early in the chain).
 */
@Component
public class TenantResolutionFilter implements GlobalFilter, Ordered {

    private static final Logger log = LoggerFactory.getLogger(TenantResolutionFilter.class);
    public static final String TENANT_ID_HEADER = "X-Tenant-ID";
    public static final String TENANT_ATTR = "tenantId";

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
        ServerHttpRequest request = exchange.getRequest();

        // 1. Try X-Tenant-ID header first
        String tenantId = request.getHeaders().getFirst(TENANT_ID_HEADER);

        // 2. Try subdomain extraction: {tenant}.api.innait.io
        if (tenantId == null || tenantId.isBlank()) {
            tenantId = extractTenantFromSubdomain(request);
        }

        if (tenantId == null || tenantId.isBlank()) {
            // For public endpoints, tenant may not be required
            String path = request.getPath().value();
            if (isPublicPath(path)) {
                return chain.filter(exchange);
            }
            log.warn("No tenant ID resolved for request: {}", path);
            exchange.getResponse().setStatusCode(HttpStatus.BAD_REQUEST);
            return exchange.getResponse().setComplete();
        }

        // Store in exchange attributes and add to downstream headers
        exchange.getAttributes().put(TENANT_ATTR, tenantId);

        ServerHttpRequest mutatedRequest = request.mutate()
                .header(TENANT_ID_HEADER, tenantId)
                .build();

        return chain.filter(exchange.mutate().request(mutatedRequest).build());
    }

    String extractTenantFromSubdomain(ServerHttpRequest request) {
        InetSocketAddress hostAddress = request.getHeaders().getHost();
        if (hostAddress == null) return null;

        String host = hostAddress.getHostString();
        // Pattern: {tenant}.api.innait.io
        if (host != null && host.contains(".api.")) {
            String subdomain = host.substring(0, host.indexOf(".api."));
            if (!subdomain.isBlank()) {
                return subdomain;
            }
        }
        return null;
    }

    private boolean isPublicPath(String path) {
        return path.startsWith("/api/v1/auth/login")
                || path.startsWith("/api/v1/tokens/refresh")
                || path.startsWith("/api/v1/admin/tenants/resolve")
                || path.startsWith("/.well-known")
                || path.startsWith("/actuator")
                || path.startsWith("/swagger-ui")
                || path.startsWith("/v3/api-docs");
    }

    @Override
    public int getOrder() {
        return 10;
    }
}
