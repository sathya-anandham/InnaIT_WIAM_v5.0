package io.innait.wiam.common.redis;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;
import org.springframework.data.redis.core.script.RedisScript;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@SuppressWarnings("unchecked")
@ExtendWith(MockitoExtension.class)
class RateLimiterServiceTest {

    @Mock
    private StringRedisTemplate redisTemplate;

    @Mock
    private ValueOperations<String, String> valueOperations;

    @Captor
    private ArgumentCaptor<List<String>> keysCaptor;

    private RateLimiterService rateLimiterService;

    @BeforeEach
    void setUp() {
        rateLimiterService = new RateLimiterService(redisTemplate);
    }

    @Test
    void shouldAllowRequestWithinLimit() {
        UUID tenantId = UUID.randomUUID();
        when(redisTemplate.execute(any(RedisScript.class), anyList(), any(String.class), any(String.class)))
                .thenReturn(3L);

        boolean allowed = rateLimiterService.isAllowed(tenantId, "192.168.1.1", 10, 60);

        assertThat(allowed).isTrue();
    }

    @Test
    void shouldDenyRequestExceedingLimit() {
        UUID tenantId = UUID.randomUUID();
        when(redisTemplate.execute(any(RedisScript.class), anyList(), any(String.class), any(String.class)))
                .thenReturn(11L);

        boolean allowed = rateLimiterService.isAllowed(tenantId, "10.0.0.1", 10, 60);

        assertThat(allowed).isFalse();
    }

    @Test
    void shouldAllowRequestAtExactLimit() {
        UUID tenantId = UUID.randomUUID();
        when(redisTemplate.execute(any(RedisScript.class), anyList(), any(String.class), any(String.class)))
                .thenReturn(10L);

        boolean allowed = rateLimiterService.isAllowed(tenantId, "192.168.1.1", 10, 60);

        assertThat(allowed).isTrue();
    }

    @Test
    void shouldUseCorrectRedisKey() {
        UUID tenantId = UUID.randomUUID();
        when(redisTemplate.execute(any(RedisScript.class), keysCaptor.capture(), any(String.class), any(String.class)))
                .thenReturn(1L);

        rateLimiterService.isAllowed(tenantId, "10.0.0.5", 100, 60);

        String expectedKey = RedisCacheKeys.rateLimitKey(tenantId, "10.0.0.5");
        assertThat(keysCaptor.getValue()).containsExactly(expectedKey);
    }

    @Test
    void shouldReturnCurrentCount() {
        UUID tenantId = UUID.randomUUID();
        String key = RedisCacheKeys.rateLimitKey(tenantId, "10.0.0.1");
        when(redisTemplate.opsForValue()).thenReturn(valueOperations);
        when(valueOperations.get(key)).thenReturn("7");

        long count = rateLimiterService.getCurrentCount(tenantId, "10.0.0.1");

        assertThat(count).isEqualTo(7);
    }

    @Test
    void shouldReturnZeroWhenNoCountExists() {
        UUID tenantId = UUID.randomUUID();
        String key = RedisCacheKeys.rateLimitKey(tenantId, "10.0.0.1");
        when(redisTemplate.opsForValue()).thenReturn(valueOperations);
        when(valueOperations.get(key)).thenReturn(null);

        long count = rateLimiterService.getCurrentCount(tenantId, "10.0.0.1");

        assertThat(count).isEqualTo(0);
    }

    @Test
    void shouldHandleNullResponseFromScript() {
        UUID tenantId = UUID.randomUUID();
        when(redisTemplate.execute(any(RedisScript.class), anyList(), any(String.class), any(String.class)))
                .thenReturn(null);

        boolean allowed = rateLimiterService.isAllowed(tenantId, "10.0.0.1", 10, 60);

        assertThat(allowed).isFalse();
    }
}
