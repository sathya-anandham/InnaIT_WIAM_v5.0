package io.innait.wiam.apigateway.health;

import org.springframework.boot.actuate.health.Health;
import org.springframework.boot.actuate.health.ReactiveHealthIndicator;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;

import java.time.Duration;

/**
 * Health indicator for a single downstream service.
 * Checks the /actuator/health endpoint of the service.
 */
public class DownstreamServiceHealthIndicator implements ReactiveHealthIndicator {

    private final String serviceName;
    private final String healthUrl;
    private final WebClient webClient;

    public DownstreamServiceHealthIndicator(String serviceName, String baseUrl) {
        this.serviceName = serviceName;
        this.healthUrl = baseUrl + "/actuator/health";
        this.webClient = WebClient.builder().build();
    }

    @Override
    public Mono<Health> health() {
        return webClient.get()
                .uri(healthUrl)
                .retrieve()
                .bodyToMono(String.class)
                .timeout(Duration.ofSeconds(3))
                .map(body -> Health.up()
                        .withDetail("service", serviceName)
                        .withDetail("url", healthUrl)
                        .build())
                .onErrorResume(e -> Mono.just(Health.down()
                        .withDetail("service", serviceName)
                        .withDetail("url", healthUrl)
                        .withDetail("error", e.getMessage())
                        .build()));
    }
}
