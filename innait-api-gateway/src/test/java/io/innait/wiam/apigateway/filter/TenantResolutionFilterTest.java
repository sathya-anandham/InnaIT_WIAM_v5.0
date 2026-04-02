package io.innait.wiam.apigateway.filter;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.cloud.gateway.filter.GatewayFilterChain;
import org.springframework.http.HttpStatus;
import org.springframework.mock.http.server.reactive.MockServerHttpRequest;
import org.springframework.mock.web.server.MockServerWebExchange;
import reactor.core.publisher.Mono;

import java.net.InetSocketAddress;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class TenantResolutionFilterTest {

    private TenantResolutionFilter filter;
    private GatewayFilterChain chain;

    @BeforeEach
    void setUp() {
        filter = new TenantResolutionFilter();
        chain = mock(GatewayFilterChain.class);
        when(chain.filter(any())).thenReturn(Mono.empty());
    }

    @Nested
    class SubdomainExtraction {

        @Test
        void shouldExtractTenantFromSubdomain() {
            MockServerHttpRequest request = MockServerHttpRequest.get("/api/v1/identity/users")
                    .header("Host", "acme.api.innait.io")
                    .build();

            String tenant = filter.extractTenantFromSubdomain(request);
            assertThat(tenant).isEqualTo("acme");
        }

        @Test
        void shouldReturnNullForNoSubdomain() {
            MockServerHttpRequest request = MockServerHttpRequest.get("/api/v1/identity/users")
                    .header("Host", "api.innait.io")
                    .build();

            String tenant = filter.extractTenantFromSubdomain(request);
            assertThat(tenant).isNull();
        }

        @Test
        void shouldReturnNullForLocalhost() {
            MockServerHttpRequest request = MockServerHttpRequest.get("/api/v1/identity/users")
                    .header("Host", "localhost:8080")
                    .build();

            String tenant = filter.extractTenantFromSubdomain(request);
            assertThat(tenant).isNull();
        }
    }

    @Nested
    class HeaderExtraction {

        @Test
        void shouldUseTenantFromHeader() {
            MockServerHttpRequest request = MockServerHttpRequest.get("/api/v1/identity/users")
                    .header("X-Tenant-ID", "tenant-123")
                    .header("Host", "localhost:8080")
                    .build();
            MockServerWebExchange exchange = MockServerWebExchange.from(request);

            filter.filter(exchange, chain).block();

            assertThat(exchange.getAttributes().get(TenantResolutionFilter.TENANT_ATTR))
                    .isEqualTo("tenant-123");
        }

        @Test
        void shouldPreferHeaderOverSubdomain() {
            MockServerHttpRequest request = MockServerHttpRequest.get("/api/v1/identity/users")
                    .header("X-Tenant-ID", "from-header")
                    .header("Host", "from-subdomain.api.innait.io")
                    .build();
            MockServerWebExchange exchange = MockServerWebExchange.from(request);

            filter.filter(exchange, chain).block();

            assertThat(exchange.getAttributes().get(TenantResolutionFilter.TENANT_ATTR))
                    .isEqualTo("from-header");
        }
    }

    @Nested
    class PublicPaths {

        @Test
        void shouldAllowPublicPathWithoutTenant() {
            MockServerHttpRequest request = MockServerHttpRequest.get("/api/v1/auth/login/start")
                    .header("Host", "localhost:8080")
                    .build();
            MockServerWebExchange exchange = MockServerWebExchange.from(request);

            filter.filter(exchange, chain).block();

            // Should pass through without 400
            assertThat(exchange.getResponse().getStatusCode()).isNotEqualTo(HttpStatus.BAD_REQUEST);
        }

        @Test
        void shouldAllowWellKnownEndpoints() {
            MockServerHttpRequest request = MockServerHttpRequest.get("/.well-known/jwks.json")
                    .header("Host", "localhost:8080")
                    .build();
            MockServerWebExchange exchange = MockServerWebExchange.from(request);

            filter.filter(exchange, chain).block();

            assertThat(exchange.getResponse().getStatusCode()).isNotEqualTo(HttpStatus.BAD_REQUEST);
        }

        @Test
        void shouldReject400WhenNoTenantOnProtectedPath() {
            MockServerHttpRequest request = MockServerHttpRequest.get("/api/v1/identity/users")
                    .header("Host", "localhost:8080")
                    .build();
            MockServerWebExchange exchange = MockServerWebExchange.from(request);

            filter.filter(exchange, chain).block();

            assertThat(exchange.getResponse().getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        }
    }
}
