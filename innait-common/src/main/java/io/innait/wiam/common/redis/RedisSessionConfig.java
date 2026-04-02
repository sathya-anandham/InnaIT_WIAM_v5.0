package io.innait.wiam.common.redis;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.serializer.GenericJackson2JsonRedisSerializer;
import org.springframework.data.redis.serializer.RedisSerializer;
import org.springframework.session.data.redis.config.annotation.web.http.EnableRedisHttpSession;

/**
 * Spring Session configuration backed by Redis with JSON serialization.
 * Session namespace: spring:session:{tenantId}:{sessionId}
 */
@Configuration
@EnableRedisHttpSession(
        maxInactiveIntervalInSeconds = 1800, // 30 minutes default
        redisNamespace = "spring:session"
)
public class RedisSessionConfig {

    @Bean("springSessionDefaultRedisSerializer")
    public RedisSerializer<Object> springSessionDefaultRedisSerializer() {
        return new GenericJackson2JsonRedisSerializer();
    }
}
