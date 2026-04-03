package io.innait.wiam.apigateway.filter;

import io.innait.wiam.apigateway.config.GatewayProperties;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.cloud.gateway.filter.GatewayFilterChain;
import org.springframework.data.redis.core.ReactiveStringRedisTemplate;
import org.springframework.data.redis.core.ReactiveValueOperations;
import org.springframework.http.HttpStatus;
import org.springframework.mock.http.server.reactive.MockServerHttpRequest;
import org.springframework.mock.web.server.MockServerWebExchange;
import reactor.core.publisher.Mono;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class RateLimitFilterTest {

    @Mock private ReactiveStringRedisTemplate redisTemplate;
    @Mock private ReactiveValueOperations<String, String> valueOps;

    private RateLimitFilter filter;
    private GatewayFilterChain chain;

    @BeforeEach
    void setUp() {
        GatewayProperties props = new GatewayProperties();
        props.getRateLimit().setLoginPerMinute(5);
        props.getRateLimit().setApiPerMinute(20);
        filter = new RateLimitFilter(redisTemplate, props);
        chain = mock(GatewayFilterChain.class);
        when(chain.filter(any())).thenReturn(Mono.empty());
    }

    @Nested
    class KeyBuilding {

        @Test
        void shouldBuildKeyWithTenantAndIp() {
            String key = filter.buildKey("tenant-123", "192.168.1.1", false);
            assertThat(key).isEqualTo("ratelimit:tenant-123:192.168.1.1:api");
        }

        @Test
        void shouldBuildLoginKeyWithTenantAndIp() {
            String key = filter.buildKey("tenant-123", "192.168.1.1", true);
            assertThat(key).isEqualTo("ratelimit:tenant-123:192.168.1.1:login");
        }

        @Test
        void shouldBuildKeyWithoutTenant() {
            String key = filter.buildKey(null, "10.0.0.1", false);
            assertThat(key).isEqualTo("ratelimit:10.0.0.1:api");
        }
    }

    @Nested
    class RateLimiting {

        @Test
        void shouldAllowRequestWithinLimit() {
            when(redisTemplate.opsForValue()).thenReturn(valueOps);
            when(valueOps.increment(anyString())).thenReturn(Mono.just(1L));
            when(redisTemplate.expire(anyString(), any())).thenReturn(Mono.just(true));

            MockServerHttpRequest request = MockServerHttpRequest.get("/api/v1/identity/users")
                    .remoteAddress(new java.net.InetSocketAddress("192.168.1.1", 12345))
                    .build();
            MockServerWebExchange exchange = MockServerWebExchange.from(request);
            exchange.getAttributes().put(TenantResolutionFilter.TENANT_ATTR, "tenant-1");

            filter.filter(exchange, chain).block();

            assertThat(exchange.getResponse().getStatusCode()).isNotEqualTo(HttpStatus.TOO_MANY_REQUESTS);
        }

        @Test
        void shouldReject429WhenLimitExceeded() {
            when(redisTemplate.opsForValue()).thenReturn(valueOps);
            when(valueOps.increment(anyString())).thenReturn(Mono.just(21L)); // Over 20 API limit

            MockServerHttpRequest request = MockServerHttpRequest.get("/api/v1/identity/users")
                    .remoteAddress(new java.net.InetSocketAddress("192.168.1.1", 12345))
                    .build();
            MockServerWebExchange exchange = MockServerWebExchange.from(request);
            exchange.getAttributes().put(TenantResolutionFilter.TENANT_ATTR, "tenant-1");

            filter.filter(exchange, chain).block();

            assertThat(exchange.getResponse().getStatusCode()).isEqualTo(HttpStatus.TOO_MANY_REQUESTS);
            assertThat(exchange.getResponse().getHeaders().getFirst("Retry-After")).isEqualTo("60");
        }

        @Test
        void shouldApplyLowerLimitForLoginPaths() {
            when(redisTemplate.opsForValue()).thenReturn(valueOps);
            when(valueOps.increment(anyString())).thenReturn(Mono.just(6L)); // Over 5 login limit

            MockServerHttpRequest request = MockServerHttpRequest.post("/api/v1/auth/login/start")
                    .remoteAddress(new java.net.InetSocketAddress("192.168.1.1", 12345))
                    .build();
            MockServerWebExchange exchange = MockServerWebExchange.from(request);

            filter.filter(exchange, chain).block();

            assertThat(exchange.getResponse().getStatusCode()).isEqualTo(HttpStatus.TOO_MANY_REQUESTS);
        }

        @Test
        void shouldAllowWhenRedisUnavailable() {
            when(redisTemplate.opsForValue()).thenReturn(valueOps);
            when(valueOps.increment(anyString())).thenReturn(Mono.error(new RuntimeException("Redis down")));

            MockServerHttpRequest request = MockServerHttpRequest.get("/api/v1/identity/users")
                    .remoteAddress(new java.net.InetSocketAddress("192.168.1.1", 12345))
                    .build();
            MockServerWebExchange exchange = MockServerWebExchange.from(request);

            filter.filter(exchange, chain).block();

            // Graceful degradation - should NOT be 429
            assertThat(exchange.getResponse().getStatusCode()).isNotEqualTo(HttpStatus.TOO_MANY_REQUESTS);
        }
    }

    @Nested
    class ClientIpExtraction {

        @Test
        void shouldExtractIpFromXForwardedFor() {
            MockServerHttpRequest request = MockServerHttpRequest.get("/api/v1/test")
                    .header("X-Forwarded-For", "203.0.113.50, 70.41.3.18, 150.172.238.178")
                    .build();

            String ip = filter.extractClientIp(request);
            assertThat(ip).isEqualTo("203.0.113.50");
        }

        @Test
        void shouldExtractIpFromRemoteAddress() {
            MockServerHttpRequest request = MockServerHttpRequest.get("/api/v1/test")
                    .remoteAddress(new java.net.InetSocketAddress("10.0.0.1", 5000))
                    .build();

            String ip = filter.extractClientIp(request);
            assertThat(ip).isEqualTo("10.0.0.1");
        }
    }
}
