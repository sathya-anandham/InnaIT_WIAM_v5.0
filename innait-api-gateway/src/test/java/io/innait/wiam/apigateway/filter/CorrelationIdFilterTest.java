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

class CorrelationIdFilterTest {

    private CorrelationIdFilter filter;
    private GatewayFilterChain chain;

    @BeforeEach
    void setUp() {
        filter = new CorrelationIdFilter();
        chain = mock(GatewayFilterChain.class);
        when(chain.filter(any())).thenReturn(Mono.empty());
    }

    @Nested
    class CorrelationIdHandling {

        @Test
        void shouldGenerateCorrelationIdWhenMissing() {
            MockServerHttpRequest request = MockServerHttpRequest.get("/api/v1/test").build();
            MockServerWebExchange exchange = MockServerWebExchange.from(request);

            filter.filter(exchange, chain).block();

            String correlationId = exchange.getResponse().getHeaders()
                    .getFirst(CorrelationIdFilter.CORRELATION_ID_HEADER);
            assertThat(correlationId).isNotNull();
            assertThat(correlationId).isNotBlank();
            // Should be a UUID format
            assertThat(correlationId).matches(
                    "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}");
        }

        @Test
        void shouldPropagateExistingCorrelationId() {
            String existingId = "existing-correlation-id-123";
            MockServerHttpRequest request = MockServerHttpRequest.get("/api/v1/test")
                    .header(CorrelationIdFilter.CORRELATION_ID_HEADER, existingId)
                    .build();
            MockServerWebExchange exchange = MockServerWebExchange.from(request);

            filter.filter(exchange, chain).block();

            String correlationId = exchange.getResponse().getHeaders()
                    .getFirst(CorrelationIdFilter.CORRELATION_ID_HEADER);
            assertThat(correlationId).isEqualTo(existingId);
        }

        @Test
        void shouldAddCorrelationIdToResponse() {
            MockServerHttpRequest request = MockServerHttpRequest.get("/api/v1/test").build();
            MockServerWebExchange exchange = MockServerWebExchange.from(request);

            filter.filter(exchange, chain).block();

            assertThat(exchange.getResponse().getHeaders()
                    .containsKey(CorrelationIdFilter.CORRELATION_ID_HEADER)).isTrue();
        }
    }
}
