package io.innait.wiam.common.redis;

import org.springframework.boot.actuate.health.Health;
import org.springframework.boot.actuate.health.HealthIndicator;
import org.springframework.data.redis.connection.RedisConnection;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.stereotype.Component;

/**
 * Custom health indicator that verifies Redis connectivity.
 * For Sentinel configurations, this validates master reachability.
 * Exposed via /actuator/health/redis.
 */
@Component("redis")
public class RedisHealthIndicator implements HealthIndicator {

    private final RedisConnectionFactory connectionFactory;

    public RedisHealthIndicator(RedisConnectionFactory connectionFactory) {
        this.connectionFactory = connectionFactory;
    }

    @Override
    public Health health() {
        try (RedisConnection connection = connectionFactory.getConnection()) {
            String pong = connection.ping();
            if ("PONG".equals(pong)) {
                return Health.up()
                        .withDetail("connection", "active")
                        .withDetail("ping", pong)
                        .build();
            }
            return Health.down()
                    .withDetail("connection", "active")
                    .withDetail("ping", pong)
                    .build();
        } catch (Exception e) {
            return Health.down()
                    .withDetail("error", e.getMessage())
                    .build();
        }
    }
}
