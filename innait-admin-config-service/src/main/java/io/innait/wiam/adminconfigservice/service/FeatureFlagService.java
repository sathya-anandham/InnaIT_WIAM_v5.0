package io.innait.wiam.adminconfigservice.service;

import io.innait.wiam.adminconfigservice.dto.FeatureFlagResponse;
import io.innait.wiam.adminconfigservice.entity.FeatureFlag;
import io.innait.wiam.adminconfigservice.repository.FeatureFlagRepository;
import io.innait.wiam.common.context.TenantContext;
import io.innait.wiam.common.event.EventEnvelope;
import io.innait.wiam.common.kafka.EventPublisher;
import io.innait.wiam.common.kafka.InnaITTopics;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class FeatureFlagService {

    private static final Logger log = LoggerFactory.getLogger(FeatureFlagService.class);
    private static final String REDIS_KEY_PREFIX = "ff:";
    private static final Duration CACHE_TTL = Duration.ofSeconds(60);

    private final FeatureFlagRepository repository;
    private final StringRedisTemplate redisTemplate;
    private final EventPublisher eventPublisher;

    public FeatureFlagService(FeatureFlagRepository repository,
                              StringRedisTemplate redisTemplate,
                              EventPublisher eventPublisher) {
        this.repository = repository;
        this.redisTemplate = redisTemplate;
        this.eventPublisher = eventPublisher;
    }

    /**
     * Get a feature flag value, cached in Redis with 60s TTL.
     */
    public boolean getFlag(UUID tenantId, String flagKey) {
        String cacheKey = REDIS_KEY_PREFIX + tenantId + ":" + flagKey;

        // Try cache first
        try {
            String cached = redisTemplate.opsForValue().get(cacheKey);
            if (cached != null) {
                return "1".equals(cached);
            }
        } catch (Exception e) {
            log.warn("Redis cache read failed for flag [{}]: {}", flagKey, e.getMessage());
        }

        // Fall back to DB
        boolean value = repository.findByTenantIdAndFlagKey(tenantId, flagKey)
                .map(FeatureFlag::isFlagValue)
                .orElse(false);

        // Update cache
        try {
            redisTemplate.opsForValue().set(cacheKey, value ? "1" : "0", CACHE_TTL);
        } catch (Exception e) {
            log.warn("Redis cache write failed for flag [{}]: {}", flagKey, e.getMessage());
        }

        return value;
    }

    /**
     * Set a feature flag: update DB, invalidate cache, publish event.
     */
    @Transactional
    public FeatureFlagResponse setFlag(UUID tenantId, String flagKey, boolean value) {
        TenantContext.setTenantId(tenantId);
        try {
            FeatureFlag flag = repository.findByTenantIdAndFlagKey(tenantId, flagKey)
                    .orElseGet(() -> {
                        FeatureFlag newFlag = new FeatureFlag(flagKey, value, null);
                        return newFlag;
                    });

            boolean oldValue = flag.isFlagValue();
            flag.setFlagValue(value);
            repository.save(flag);

            // Invalidate cache
            invalidateCache(tenantId, flagKey);

            // Publish event
            if (oldValue != value) {
                publishFlagChangedEvent(tenantId, flagKey, oldValue, value);
            }

            log.info("Flag [{}] set to [{}] for tenant [{}]", flagKey, value, tenantId);
            return toResponse(flag);
        } finally {
            TenantContext.clear();
        }
    }

    /**
     * List all flags for a tenant.
     */
    @Transactional(readOnly = true)
    public Map<String, Boolean> listFlags(UUID tenantId) {
        List<FeatureFlag> flags = repository.findByTenantId(tenantId);
        Map<String, Boolean> result = new LinkedHashMap<>();
        for (FeatureFlag f : flags) {
            result.put(f.getFlagKey(), f.isFlagValue());
        }
        return result;
    }

    @Transactional(readOnly = true)
    public List<FeatureFlagResponse> listFlagDetails(UUID tenantId) {
        return repository.findByTenantId(tenantId).stream()
                .map(this::toResponse).toList();
    }

    void invalidateCache(UUID tenantId, String flagKey) {
        String cacheKey = REDIS_KEY_PREFIX + tenantId + ":" + flagKey;
        try {
            redisTemplate.delete(cacheKey);
        } catch (Exception e) {
            log.warn("Redis cache invalidation failed for flag [{}]: {}", flagKey, e.getMessage());
        }
    }

    private void publishFlagChangedEvent(UUID tenantId, String flagKey,
                                         boolean oldValue, boolean newValue) {
        try {
            eventPublisher.publish(InnaITTopics.FEATURE_FLAG_CHANGED,
                    EventEnvelope.<Map<String, Object>>builder()
                            .eventId(UUID.randomUUID())
                            .eventType("feature.flag.changed")
                            .tenantId(tenantId)
                            .timestamp(Instant.now())
                            .source("innait-admin-config-service")
                            .payload(Map.of(
                                    "flag_key", flagKey,
                                    "old_value", oldValue,
                                    "new_value", newValue
                            ))
                            .build());
        } catch (Exception e) {
            log.warn("Failed to publish feature flag event: {}", e.getMessage());
        }
    }

    private FeatureFlagResponse toResponse(FeatureFlag f) {
        return new FeatureFlagResponse(f.getId(), f.getTenantId(),
                f.getFlagKey(), f.isFlagValue(), f.getDescription());
    }
}
