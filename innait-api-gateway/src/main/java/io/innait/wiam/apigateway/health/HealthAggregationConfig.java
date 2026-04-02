package io.innait.wiam.apigateway.health;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.actuate.health.ReactiveHealthIndicator;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Registers health indicators for all downstream services.
 * /actuator/health aggregates these checks.
 */
@Configuration
public class HealthAggregationConfig {

    @Bean
    public ReactiveHealthIndicator authOrchestratorHealth(
            @Value("${AUTH_ORCHESTRATOR_URL:http://localhost:8083}") String url) {
        return new DownstreamServiceHealthIndicator("auth-orchestrator", url);
    }

    @Bean
    public ReactiveHealthIndicator identityServiceHealth(
            @Value("${IDENTITY_SERVICE_URL:http://localhost:8081}") String url) {
        return new DownstreamServiceHealthIndicator("identity-service", url);
    }

    @Bean
    public ReactiveHealthIndicator credentialServiceHealth(
            @Value("${CREDENTIAL_SERVICE_URL:http://localhost:8082}") String url) {
        return new DownstreamServiceHealthIndicator("credential-service", url);
    }

    @Bean
    public ReactiveHealthIndicator sessionServiceHealth(
            @Value("${SESSION_SERVICE_URL:http://localhost:8085}") String url) {
        return new DownstreamServiceHealthIndicator("session-service", url);
    }

    @Bean
    public ReactiveHealthIndicator tokenServiceHealth(
            @Value("${TOKEN_SERVICE_URL:http://localhost:8086}") String url) {
        return new DownstreamServiceHealthIndicator("token-service", url);
    }

    @Bean
    public ReactiveHealthIndicator policyServiceHealth(
            @Value("${POLICY_SERVICE_URL:http://localhost:8087}") String url) {
        return new DownstreamServiceHealthIndicator("policy-service", url);
    }

    @Bean
    public ReactiveHealthIndicator auditServiceHealth(
            @Value("${AUDIT_SERVICE_URL:http://localhost:8088}") String url) {
        return new DownstreamServiceHealthIndicator("audit-service", url);
    }

    @Bean
    public ReactiveHealthIndicator adminConfigServiceHealth(
            @Value("${ADMIN_CONFIG_SERVICE_URL:http://localhost:8090}") String url) {
        return new DownstreamServiceHealthIndicator("admin-config-service", url);
    }

    @Bean
    public ReactiveHealthIndicator notificationServiceHealth(
            @Value("${NOTIFICATION_SERVICE_URL:http://localhost:8089}") String url) {
        return new DownstreamServiceHealthIndicator("notification-service", url);
    }
}
