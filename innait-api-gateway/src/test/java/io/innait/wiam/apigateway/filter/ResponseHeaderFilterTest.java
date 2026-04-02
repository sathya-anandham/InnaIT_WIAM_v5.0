package io.innait.wiam.apigateway.filter;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.cloud.gateway.filter.GatewayFilterChain;
import org.springframework.mock.http.server.reactive.MockServerHttpRequest;
import org.springframework.mock.web.server.MockServerWebExchange;
import reactor.core.publisher.Mono;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class ResponseHeaderFilterTest {

    private ResponseHeaderFilter filter;
    private GatewayFilterChain chain;

    @BeforeEach
    void setUp() {
        filter = new ResponseHeaderFilter();
        chain = mock(GatewayFilterChain.class);
        when(chain.filter(any())).thenReturn(Mono.empty());
    }

    @Nested
    class SecurityHeaders {

        @Test
        void shouldAddSecurityHeaders() {
            MockServerHttpRequest request = MockServerHttpRequest.get("/api/v1/test").build();
            MockServerWebExchange exchange = MockServerWebExchange.from(request);

            filter.filter(exchange, chain).block();

            var headers = exchange.getResponse().getHeaders();
            assertThat(headers.getFirst("X-Content-Type-Options")).isEqualTo("nosniff");
            assertThat(headers.getFirst("X-Frame-Options")).isEqualTo("DENY");
            assertThat(headers.getFirst("X-XSS-Protection")).isEqualTo("1; mode=block");
            assertThat(headers.getFirst("Strict-Transport-Security"))
                    .contains("max-age=31536000");
        }

        @Test
        void shouldAddCacheControlForApiPaths() {
            MockServerHttpRequest request = MockServerHttpRequest.get("/api/v1/identity/users").build();
            MockServerWebExchange exchange = MockServerWebExchange.from(request);

            filter.filter(exchange, chain).block();

            assertThat(exchange.getResponse().getHeaders().getFirst("Cache-Control"))
                    .isEqualTo("no-store");
            assertThat(exchange.getResponse().getHeaders().getFirst("Pragma"))
                    .isEqualTo("no-cache");
        }

        @Test
        void shouldNotAddCacheControlForNonApiPaths() {
            MockServerHttpRequest request = MockServerHttpRequest.get("/swagger-ui/index.html").build();
            MockServerWebExchange exchange = MockServerWebExchange.from(request);

            filter.filter(exchange, chain).block();

            assertThat(exchange.getResponse().getHeaders().getFirst("Cache-Control")).isNull();
        }
    }
}
