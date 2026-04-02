package io.innait.wiam.common.redis;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.UUID;

/**
 * Redis-based sliding window rate limiter using an atomic Lua script (INCR + EXPIRE).
 */
@Service
public class RateLimiterService {

    private static final Logger log = LoggerFactory.getLogger(RateLimiterService.class);

    private static final String LUA_SCRIPT = """
            local key = KEYS[1]
            local limit = tonumber(ARGV[1])
            local window = tonumber(ARGV[2])
            local current = redis.call('INCR', key)
            if current == 1 then
                redis.call('EXPIRE', key, window)
            end
            return current
            """;

    private final StringRedisTemplate redisTemplate;
    private final DefaultRedisScript<Long> rateLimitScript;

    public RateLimiterService(StringRedisTemplate redisTemplate) {
        this.redisTemplate = redisTemplate;
        this.rateLimitScript = new DefaultRedisScript<>();
        this.rateLimitScript.setScriptText(LUA_SCRIPT);
        this.rateLimitScript.setResultType(Long.class);
    }

    /**
     * Check if a request is allowed under the rate limit.
     *
     * @param tenantId      the tenant identifier
     * @param ip            the client IP address
     * @param limit         max requests allowed in the window
     * @param windowSeconds sliding window duration in seconds
     * @return true if within limit, false if exceeded
     */
    public boolean isAllowed(UUID tenantId, String ip, int limit, int windowSeconds) {
        String key = RedisCacheKeys.rateLimitKey(tenantId, ip);
        Long count = redisTemplate.execute(
                rateLimitScript,
                List.of(key),
                String.valueOf(limit),
                String.valueOf(windowSeconds)
        );

        boolean allowed = count != null && count <= limit;
        if (!allowed) {
            log.warn("Rate limit exceeded for tenant [{}] ip [{}]: {}/{}", tenantId, ip, count, limit);
        }
        return allowed;
    }

    /**
     * Get current request count for a tenant/ip combination.
     */
    public long getCurrentCount(UUID tenantId, String ip) {
        String key = RedisCacheKeys.rateLimitKey(tenantId, ip);
        String value = redisTemplate.opsForValue().get(key);
        return value != null ? Long.parseLong(value) : 0;
    }
}
