package io.innait.wiam.common.redis;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.boot.actuate.health.Health;
import org.springframework.boot.actuate.health.Status;
import org.springframework.data.redis.connection.RedisConnection;
import org.springframework.data.redis.connection.RedisConnectionFactory;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class RedisHealthIndicatorTest {

    @Mock
    private RedisConnectionFactory connectionFactory;

    @Mock
    private RedisConnection connection;

    @Test
    void shouldReturnUpWhenRedisPongs() {
        when(connectionFactory.getConnection()).thenReturn(connection);
        when(connection.ping()).thenReturn("PONG");

        RedisHealthIndicator indicator = new RedisHealthIndicator(connectionFactory);
        Health health = indicator.health();

        assertThat(health.getStatus()).isEqualTo(Status.UP);
        assertThat(health.getDetails()).containsEntry("ping", "PONG");
    }

    @Test
    void shouldReturnDownWhenPingReturnsUnexpected() {
        when(connectionFactory.getConnection()).thenReturn(connection);
        when(connection.ping()).thenReturn("ERROR");

        RedisHealthIndicator indicator = new RedisHealthIndicator(connectionFactory);
        Health health = indicator.health();

        assertThat(health.getStatus()).isEqualTo(Status.DOWN);
    }

    @Test
    void shouldReturnDownWhenConnectionFails() {
        when(connectionFactory.getConnection()).thenThrow(new RuntimeException("Connection refused"));

        RedisHealthIndicator indicator = new RedisHealthIndicator(connectionFactory);
        Health health = indicator.health();

        assertThat(health.getStatus()).isEqualTo(Status.DOWN);
        assertThat(health.getDetails()).containsEntry("error", "Connection refused");
    }
}
