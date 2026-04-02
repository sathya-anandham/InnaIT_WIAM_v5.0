package io.innait.wiam.apigateway;

import com.github.tomakehurst.wiremock.WireMockServer;
import com.github.tomakehurst.wiremock.client.WireMock;
import com.github.tomakehurst.wiremock.core.WireMockConfiguration;
import io.innait.wiam.apigateway.filter.JwtValidationFilter;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.bean.MockBean;
import org.springframework.cloud.gateway.filter.GatewayFilterChain;
import org.springframework.data.redis.core.ReactiveStringRedisTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.reactive.server.WebTestClient;

import static com.github.tomakehurst.wiremock.client.WireMock.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

/**
 * Integration tests for the API Gateway.
 * Uses WireMock to simulate downstream services and validates
 * full request routing, tenant enforcement, correlation IDs,
 * security headers, fallback, and health endpoints.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("test")
class GatewayIntegrationTest {

    static final WireMockServer downstream;

    static {
        downstream = new WireMockServer(WireMockConfiguration.wireMockConfig().dynamicPort());
        downstream.start();
    }

    @Autowired
    private WebTestClient webTestClient;

    @MockBean
    private JwtValidationFilter jwtValidationFilter;

    @MockBean
    private ReactiveStringRedisTemplate redisTemplate;

    @DynamicPropertySource
    static void configureRoutes(DynamicPropertyRegistry registry) {
        String url = "http://localhost:" + downstream.port();
        registry.add("AUTH_ORCHESTRATOR_URL", () -> url);
        registry.add("IDENTITY_SERVICE_URL", () -> url);
        registry.add("CREDENTIAL_SERVICE_URL", () -> url);
        registry.add("SESSION_SERVICE_URL", () -> url);
        registry.add("TOKEN_SERVICE_URL", () -> url);
        registry.add("POLICY_SERVICE_URL", () -> url);
        registry.add("AUDIT_SERVICE_URL", () -> url);
        registry.add("ADMIN_CONFIG_SERVICE_URL", () -> url);
        registry.add("NOTIFICATION_SERVICE_URL", () -> url);
        registry.add("DIRECTORY_CONNECTOR_URL", () -> url);
        registry.add("ADMIN_BFF_URL", () -> url);
        // Relax circuit breaker for integration tests
        registry.add("resilience4j.circuitbreaker.configs.default.sliding-window-size", () -> "100");
        registry.add("resilience4j.circuitbreaker.configs.default.failure-rate-threshold", () -> "100");
    }

    @BeforeEach
    void setUp() {
        downstream.resetAll();
        // JWT filter passes all requests through (mocked out)
        when(jwtValidationFilter.filter(any(), any()))
                .thenAnswer(inv -> {
                    GatewayFilterChain chain = inv.getArgument(1);
                    return chain.filter(inv.getArgument(0));
                });
        when(jwtValidationFilter.getOrder()).thenReturn(20);
    }

    @AfterAll
    static void stopWireMock() {
        if (downstream != null && downstream.isRunning()) downstream.stop();
    }

    // ─── Routing ────────────────────────────────────────────────

    @Nested
    class RequestRouting {

        @Test
        void shouldRouteToIdentityService() {
            downstream.stubFor(get(urlPathEqualTo("/api/v1/identity/users"))
                    .willReturn(aResponse().withStatus(200)
                            .withHeader("Content-Type", "application/json")
                            .withBody("{\"status\":\"OK\",\"data\":[]}")));

            webTestClient.get()
                    .uri("/api/v1/identity/users")
                    .header("X-Tenant-ID", "tenant-1")
                    .exchange()
                    .expectStatus().isOk()
                    .expectBody().jsonPath("$.status").isEqualTo("OK");

            downstream.verify(getRequestedFor(urlPathEqualTo("/api/v1/identity/users")));
        }

        @Test
        void shouldRouteToAuthOrchestrator() {
            downstream.stubFor(post(urlPathEqualTo("/api/v1/auth/login/start"))
                    .willReturn(aResponse().withStatus(200)
                            .withHeader("Content-Type", "application/json")
                            .withBody("{\"status\":\"OK\"}")));

            webTestClient.post()
                    .uri("/api/v1/auth/login/start")
                    .header("Content-Type", "application/json")
                    .bodyValue("{\"username\":\"admin\"}")
                    .exchange()
                    .expectStatus().isOk();

            downstream.verify(postRequestedFor(urlPathEqualTo("/api/v1/auth/login/start")));
        }

        @Test
        void shouldRouteToAuditService() {
            downstream.stubFor(get(urlPathEqualTo("/api/v1/audit/events"))
                    .willReturn(aResponse().withStatus(200)
                            .withHeader("Content-Type", "application/json")
                            .withBody("{\"status\":\"OK\",\"data\":[]}")));

            webTestClient.get()
                    .uri("/api/v1/audit/events")
                    .header("X-Tenant-ID", "tenant-1")
                    .exchange()
                    .expectStatus().isOk();

            downstream.verify(getRequestedFor(urlPathEqualTo("/api/v1/audit/events")));
        }

        @Test
        void shouldRouteWellKnownToTokenService() {
            downstream.stubFor(get(urlPathEqualTo("/.well-known/jwks.json"))
                    .willReturn(aResponse().withStatus(200)
                            .withHeader("Content-Type", "application/json")
                            .withBody("{\"keys\":[]}")));

            webTestClient.get()
                    .uri("/.well-known/jwks.json")
                    .exchange()
                    .expectStatus().isOk()
                    .expectBody().jsonPath("$.keys").isArray();

            downstream.verify(getRequestedFor(urlPathEqualTo("/.well-known/jwks.json")));
        }

        @Test
        void shouldRouteToAdminConfigService() {
            downstream.stubFor(get(urlPathEqualTo("/api/v1/admin/tenants"))
                    .willReturn(aResponse().withStatus(200)
                            .withHeader("Content-Type", "application/json")
                            .withBody("{\"status\":\"OK\"}")));

            webTestClient.get()
                    .uri("/api/v1/admin/tenants")
                    .header("X-Tenant-ID", "tenant-1")
                    .exchange()
                    .expectStatus().isOk();

            downstream.verify(getRequestedFor(urlPathEqualTo("/api/v1/admin/tenants")));
        }

        @Test
        void shouldReturn404ForUnmappedPaths() {
            webTestClient.get()
                    .uri("/unknown/path")
                    .header("X-Tenant-ID", "tenant-1")
                    .exchange()
                    .expectStatus().isNotFound();
        }
    }

    // ─── Tenant enforcement ─────────────────────────────────────

    @Nested
    class TenantEnforcement {

        @Test
        void shouldReject400WhenNoTenantOnProtectedPath() {
            webTestClient.get()
                    .uri("/api/v1/identity/users")
                    .header("Host", "localhost")
                    .exchange()
                    .expectStatus().isBadRequest();
        }

        @Test
        void shouldAllowPublicPathWithoutTenant() {
            downstream.stubFor(post(urlPathEqualTo("/api/v1/auth/login/start"))
                    .willReturn(aResponse().withStatus(200)
                            .withHeader("Content-Type", "application/json")
                            .withBody("{\"status\":\"OK\"}")));

            webTestClient.post()
                    .uri("/api/v1/auth/login/start")
                    .header("Content-Type", "application/json")
                    .bodyValue("{}")
                    .exchange()
                    .expectStatus().isOk();
        }

        @Test
        void shouldPropagateTenantHeaderDownstream() {
            downstream.stubFor(get(urlPathEqualTo("/api/v1/identity/users"))
                    .willReturn(aResponse().withStatus(200)
                            .withHeader("Content-Type", "application/json")
                            .withBody("{}")));

            webTestClient.get()
                    .uri("/api/v1/identity/users")
                    .header("X-Tenant-ID", "acme-corp")
                    .exchange()
                    .expectStatus().isOk();

            downstream.verify(getRequestedFor(urlPathEqualTo("/api/v1/identity/users"))
                    .withHeader("X-Tenant-ID", WireMock.equalTo("acme-corp")));
        }
    }

    // ─── Correlation ID ─────────────────────────────────────────

    @Nested
    class CorrelationIdPropagation {

        @Test
        void shouldAddCorrelationIdToResponse() {
            downstream.stubFor(get(urlPathEqualTo("/api/v1/identity/users"))
                    .willReturn(aResponse().withStatus(200)
                            .withHeader("Content-Type", "application/json")
                            .withBody("{}")));

            webTestClient.get()
                    .uri("/api/v1/identity/users")
                    .header("X-Tenant-ID", "tenant-1")
                    .exchange()
                    .expectStatus().isOk()
                    .expectHeader().exists("X-Correlation-ID");
        }

        @Test
        void shouldPropagateProvidedCorrelationId() {
            downstream.stubFor(get(urlPathEqualTo("/api/v1/identity/users"))
                    .willReturn(aResponse().withStatus(200)
                            .withHeader("Content-Type", "application/json")
                            .withBody("{}")));

            webTestClient.get()
                    .uri("/api/v1/identity/users")
                    .header("X-Tenant-ID", "tenant-1")
                    .header("X-Correlation-ID", "my-trace-123")
                    .exchange()
                    .expectStatus().isOk()
                    .expectHeader().valueEquals("X-Correlation-ID", "my-trace-123");
        }

        @Test
        void shouldForwardCorrelationIdToDownstream() {
            downstream.stubFor(get(urlPathEqualTo("/api/v1/identity/users"))
                    .willReturn(aResponse().withStatus(200)
                            .withHeader("Content-Type", "application/json")
                            .withBody("{}")));

            webTestClient.get()
                    .uri("/api/v1/identity/users")
                    .header("X-Tenant-ID", "tenant-1")
                    .header("X-Correlation-ID", "trace-abc-999")
                    .exchange()
                    .expectStatus().isOk();

            downstream.verify(getRequestedFor(urlPathEqualTo("/api/v1/identity/users"))
                    .withHeader("X-Correlation-ID", WireMock.equalTo("trace-abc-999")));
        }
    }

    // ─── Security headers ───────────────────────────────────────

    @Nested
    class SecurityHeaders {

        @Test
        void shouldAddSecurityHeadersToResponse() {
            downstream.stubFor(get(urlPathEqualTo("/api/v1/identity/users"))
                    .willReturn(aResponse().withStatus(200)
                            .withHeader("Content-Type", "application/json")
                            .withBody("{}")));

            webTestClient.get()
                    .uri("/api/v1/identity/users")
                    .header("X-Tenant-ID", "tenant-1")
                    .exchange()
                    .expectStatus().isOk()
                    .expectHeader().valueEquals("X-Content-Type-Options", "nosniff")
                    .expectHeader().valueEquals("X-Frame-Options", "DENY")
                    .expectHeader().valueEquals("X-XSS-Protection", "1; mode=block")
                    .expectHeader().exists("Strict-Transport-Security");
        }

        @Test
        void shouldAddCacheControlForApiPaths() {
            downstream.stubFor(get(urlPathEqualTo("/api/v1/identity/users"))
                    .willReturn(aResponse().withStatus(200)
                            .withHeader("Content-Type", "application/json")
                            .withBody("{}")));

            webTestClient.get()
                    .uri("/api/v1/identity/users")
                    .header("X-Tenant-ID", "tenant-1")
                    .exchange()
                    .expectStatus().isOk()
                    .expectHeader().valueEquals("Cache-Control", "no-store")
                    .expectHeader().valueEquals("Pragma", "no-cache");
        }
    }

    // ─── Circuit breaker fallback ───────────────────────────────

    @Nested
    class CircuitBreakerFallback {

        @Test
        void shouldReturnFallbackResponse() {
            webTestClient.get()
                    .uri("/fallback")
                    .exchange()
                    .expectStatus().isEqualTo(503)
                    .expectBody()
                    .jsonPath("$.status").isEqualTo("ERROR")
                    .jsonPath("$.error.code").isEqualTo("SERVICE_UNAVAILABLE")
                    .jsonPath("$.error.message").isNotEmpty();
        }
    }

    // ─── Health endpoint ────────────────────────────────────────

    @Nested
    class HealthAggregation {

        @Test
        void shouldExposeHealthEndpoint() {
            webTestClient.get()
                    .uri("/actuator/health")
                    .exchange()
                    .expectStatus().isOk();
        }
    }
}
