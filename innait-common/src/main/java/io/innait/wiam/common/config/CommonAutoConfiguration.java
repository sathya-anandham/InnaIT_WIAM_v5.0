package io.innait.wiam.common.config;

import io.innait.wiam.common.filter.CorrelationFilter;
import io.innait.wiam.common.filter.TenantContextFilter;
import io.innait.wiam.common.kafka.EventPublisher;
import io.innait.wiam.common.kafka.KafkaConsumerConfig;
import io.innait.wiam.common.kafka.KafkaProducerConfig;
import io.innait.wiam.common.kafka.KafkaTopicConfig;
import io.innait.wiam.common.redis.RedisConfig;
import io.innait.wiam.common.redis.RedisHealthIndicator;
import io.innait.wiam.common.redis.RedisSessionConfig;
import io.innait.wiam.common.redis.TenantAwareCacheManager;
import io.innait.wiam.common.redis.RateLimiterService;
import io.innait.wiam.common.security.JwtAuthenticationFilter;
import io.innait.wiam.common.security.MethodSecurityConfig;
import io.innait.wiam.common.security.SecurityConfig;
import io.innait.wiam.common.security.TenantAwarePermissionEvaluator;
import io.innait.wiam.common.security.TenantSecurityFilter;
import org.springframework.boot.autoconfigure.AutoConfiguration;
import org.springframework.boot.autoconfigure.kafka.KafkaAutoConfiguration;
import org.springframework.context.annotation.Import;

/**
 * Auto-configuration for shared InnaIT WIAM common beans.
 * Runs before KafkaAutoConfiguration so the custom KafkaTemplate<String, Object>
 * from KafkaProducerConfig takes precedence over Spring Boot's default template.
 */
@AutoConfiguration(before = KafkaAutoConfiguration.class)
@Import({
        // Kafka
        KafkaProducerConfig.class,
        KafkaConsumerConfig.class,
        KafkaTopicConfig.class,
        EventPublisher.class,
        // Redis
        RedisConfig.class,
        RedisSessionConfig.class,
        TenantAwareCacheManager.class,
        RedisHealthIndicator.class,
        RateLimiterService.class,
        // Security filters and configs
        JwtAuthenticationFilter.class,
        TenantAwarePermissionEvaluator.class,
        TenantSecurityFilter.class,
        SecurityConfig.class,
        MethodSecurityConfig.class,
        // Request filters
        TenantContextFilter.class,
        CorrelationFilter.class,
        // JPA tenant filter (conditional on EntityManager)
        HibernateFilterConfig.class
})
public class CommonAutoConfiguration {
}
