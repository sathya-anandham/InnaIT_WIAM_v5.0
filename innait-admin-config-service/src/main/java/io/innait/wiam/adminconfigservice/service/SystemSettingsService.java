package io.innait.wiam.adminconfigservice.service;

import io.innait.wiam.adminconfigservice.dto.SystemSettingResponse;
import io.innait.wiam.adminconfigservice.entity.SettingValueType;
import io.innait.wiam.adminconfigservice.entity.SystemSetting;
import io.innait.wiam.adminconfigservice.repository.SystemSettingRepository;
import io.innait.wiam.common.event.EventEnvelope;
import io.innait.wiam.common.kafka.EventPublisher;
import io.innait.wiam.common.kafka.InnaITTopics;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.*;

@Service
public class SystemSettingsService {

    private static final Logger log = LoggerFactory.getLogger(SystemSettingsService.class);

    private final SystemSettingRepository repository;
    private final EventPublisher eventPublisher;

    public SystemSettingsService(SystemSettingRepository repository, EventPublisher eventPublisher) {
        this.repository = repository;
        this.eventPublisher = eventPublisher;
    }

    /**
     * Get a setting value: tenant override > global.
     */
    @Transactional(readOnly = true)
    public String getSetting(UUID tenantId, String key) {
        // Try tenant override first
        if (tenantId != null) {
            Optional<SystemSetting> tenantSetting = repository.findTenantSetting(tenantId, key);
            if (tenantSetting.isPresent()) {
                return tenantSetting.get().getSettingValue();
            }
        }

        // Fall back to global
        return repository.findGlobalSetting(key)
                .map(SystemSetting::getSettingValue)
                .orElse(null);
    }

    /**
     * Get a setting with full detail, resolving tenant > global.
     */
    @Transactional(readOnly = true)
    public SystemSettingResponse getSettingDetail(UUID tenantId, String key) {
        // Try tenant override first
        if (tenantId != null) {
            Optional<SystemSetting> tenantSetting = repository.findTenantSetting(tenantId, key);
            if (tenantSetting.isPresent()) {
                return toResponse(tenantSetting.get(), true);
            }
        }

        SystemSetting global = repository.findGlobalSetting(key)
                .orElseThrow(() -> new IllegalArgumentException("Setting not found: " + key));
        return toResponse(global, false);
    }

    /**
     * Set a tenant-specific override.
     */
    @Transactional
    public SystemSettingResponse setSetting(UUID tenantId, String key, String value) {
        Optional<SystemSetting> existing = repository.findTenantSetting(tenantId, key);

        SystemSetting setting;
        if (existing.isPresent()) {
            setting = existing.get();
            setting.setSettingValue(value);
        } else {
            // Derive value type from global default if available
            SettingValueType valueType = repository.findGlobalSetting(key)
                    .map(SystemSetting::getValueType)
                    .orElse(SettingValueType.STRING);

            setting = new SystemSetting(tenantId, key, value, valueType, null, false);
        }

        repository.save(setting);
        log.info("Setting [{}] set to [{}] for tenant [{}]", key, value, tenantId);

        publishConfigEvent(tenantId, key, value);

        return toResponse(setting, true);
    }

    /**
     * List all settings for a tenant: merged global + tenant overrides.
     */
    @Transactional(readOnly = true)
    public List<SystemSettingResponse> listSettings(UUID tenantId) {
        Map<String, SystemSettingResponse> result = new LinkedHashMap<>();

        // Start with global defaults
        for (SystemSetting global : repository.findAllGlobalSettings()) {
            result.put(global.getSettingKey(), toResponse(global, false));
        }

        // Apply tenant overrides
        if (tenantId != null) {
            for (SystemSetting tenantSetting : repository.findAllTenantSettings(tenantId)) {
                result.put(tenantSetting.getSettingKey(), toResponse(tenantSetting, true));
            }
        }

        return new ArrayList<>(result.values());
    }

    private void publishConfigEvent(UUID tenantId, String key, String value) {
        try {
            eventPublisher.publish(InnaITTopics.CONFIG_UPDATED,
                    EventEnvelope.<Map<String, String>>builder()
                            .eventId(UUID.randomUUID())
                            .eventType("config.updated")
                            .tenantId(tenantId)
                            .timestamp(Instant.now())
                            .source("innait-admin-config-service")
                            .payload(Map.of("setting_key", key, "setting_value", value))
                            .build());
        } catch (Exception e) {
            log.warn("Failed to publish config event: {}", e.getMessage());
        }
    }

    private SystemSettingResponse toResponse(SystemSetting s, boolean tenantOverride) {
        return new SystemSettingResponse(s.getSettingId(), s.getTenantId(),
                s.getSettingKey(), s.isSensitive() ? "***" : s.getSettingValue(),
                s.getValueType(), s.getDescription(), s.isSensitive(), tenantOverride);
    }
}
