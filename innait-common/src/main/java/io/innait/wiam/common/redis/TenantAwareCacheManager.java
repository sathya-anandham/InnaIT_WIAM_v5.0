package io.innait.wiam.common.redis;

import io.innait.wiam.common.context.TenantContext;
import org.springframework.cache.Cache;
import org.springframework.cache.CacheManager;
import org.springframework.data.redis.cache.RedisCacheConfiguration;
import org.springframework.data.redis.cache.RedisCacheManager;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.serializer.GenericJackson2JsonRedisSerializer;
import org.springframework.data.redis.serializer.RedisSerializationContext;
import org.springframework.data.redis.serializer.StringRedisSerializer;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.util.Collection;
import java.util.Collections;
import java.util.UUID;

/**
 * Cache manager that auto-prefixes all cache keys with the current tenant ID.
 * Prevents cross-tenant cache access by namespace isolation.
 */
@Component
public class TenantAwareCacheManager implements CacheManager {

    private final RedisCacheManager delegate;

    public TenantAwareCacheManager(RedisConnectionFactory connectionFactory) {
        RedisCacheConfiguration config = RedisCacheConfiguration.defaultCacheConfig()
                .entryTtl(Duration.ofSeconds(RedisCacheKeys.POLICY_CACHE_TTL))
                .serializeKeysWith(RedisSerializationContext.SerializationPair
                        .fromSerializer(new StringRedisSerializer()))
                .serializeValuesWith(RedisSerializationContext.SerializationPair
                        .fromSerializer(new GenericJackson2JsonRedisSerializer()))
                .disableCachingNullValues();

        this.delegate = RedisCacheManager.builder(connectionFactory)
                .cacheDefaults(config)
                .build();
        this.delegate.initializeCaches();
    }

    @Override
    public Cache getCache(String name) {
        String tenantPrefixedName = resolveTenantCacheName(name);
        return delegate.getCache(tenantPrefixedName);
    }

    @Override
    public Collection<String> getCacheNames() {
        return Collections.unmodifiableCollection(delegate.getCacheNames());
    }

    private String resolveTenantCacheName(String name) {
        UUID tenantId = TenantContext.getTenantId();
        if (tenantId != null) {
            return tenantId + ":" + name;
        }
        return name;
    }
}
