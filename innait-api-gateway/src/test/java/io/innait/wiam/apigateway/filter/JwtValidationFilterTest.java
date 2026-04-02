package io.innait.wiam.apigateway.filter;

import io.innait.wiam.apigateway.config.GatewayProperties;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.cloud.gateway.filter.GatewayFilterChain;
import org.springframework.http.HttpStatus;
import org.springframework.mock.http.server.reactive.MockServerHttpRequest;
import org.springframework.mock.web.server.MockServerWebExchange;
import reactor.core.publisher.Mono;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class JwtValidationFilterTest {

    private JwtValidationFilter filter;
    private GatewayFilterChain chain;

    @BeforeEach
    void setUp() {
        GatewayProperties props = new GatewayProperties();
        props.setPublicPaths(List.of(
                "/api/v1/auth/login/**",
                "/api/v1/tokens/refresh",
                "/.well-known/**",
                "/actuator/health"
        ));
        filter = new JwtValidationFilter(props);
        chain = mock(GatewayFilterChain.class);
        when(chain.filter(any())).thenReturn(Mono.empty());
    }

    @Nested
    class PublicPathSkipping {

        @Test
        void shouldSkipLoginEndpoints() {
            assertThat(filter.isPublicPath("/api/v1/auth/login/start")).isTrue();
        }

        @Test
        void shouldSkipTokenRefresh() {
            assertThat(filter.isPublicPath("/api/v1/tokens/refresh")).isTrue();
        }

        @Test
        void shouldSkipWellKnown() {
            assertThat(filter.isPublicPath("/.well-known/jwks.json")).isTrue();
        }

        @Test
        void shouldSkipActuatorHealth() {
            assertThat(filter.isPublicPath("/actuator/health")).isTrue();
        }

        @Test
        void shouldNotSkipProtectedPaths() {
            assertThat(filter.isPublicPath("/api/v1/identity/users")).isFalse();
            assertThat(filter.isPublicPath("/api/v1/admin/tenants")).isFalse();
        }
    }

    @Nested
    class AuthorizationHeaderValidation {

        @Test
        void shouldReject401WhenNoAuthHeader() {
            MockServerHttpRequest request = MockServerHttpRequest.get("/api/v1/identity/users")
                    .build();
            MockServerWebExchange exchange = MockServerWebExchange.from(request);

            filter.filter(exchange, chain).block();

            assertThat(exchange.getResponse().getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
        }

        @Test
        void shouldReject401WhenNotBearerToken() {
            MockServerHttpRequest request = MockServerHttpRequest.get("/api/v1/identity/users")
                    .header("Authorization", "Basic dXNlcjpwYXNz")
                    .build();
            MockServerWebExchange exchange = MockServerWebExchange.from(request);

            filter.filter(exchange, chain).block();

            assertThat(exchange.getResponse().getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
        }

        @Test
        void shouldReject401WhenTokenInvalid() {
            // JWT processor is not initialized in unit test, so any token will fail
            MockServerHttpRequest request = MockServerHttpRequest.get("/api/v1/identity/users")
                    .header("Authorization", "Bearer invalid.jwt.token")
                    .build();
            MockServerWebExchange exchange = MockServerWebExchange.from(request);

            filter.filter(exchange, chain).block();

            assertThat(exchange.getResponse().getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
        }

        @Test
        void shouldPassPublicEndpointWithoutAuth() {
            MockServerHttpRequest request = MockServerHttpRequest.get("/api/v1/auth/login/start")
                    .build();
            MockServerWebExchange exchange = MockServerWebExchange.from(request);

            filter.filter(exchange, chain).block();

            // Should not be 401 - public path
            assertThat(exchange.getResponse().getStatusCode()).isNotEqualTo(HttpStatus.UNAUTHORIZED);
        }
    }
}
