package io.innait.wiam.adminconfigservice.entity;

import jakarta.persistence.*;

import java.time.Instant;
import java.util.UUID;

/**
 * System settings with nullable TENANT_ID (null = global/system-wide setting).
 * Standalone entity because BaseEntity requires non-null tenantId.
 */
@Entity
@Table(name = "SYSTEM_SETTINGS")
public class SystemSetting {

    @Id
    @Column(name = "SETTING_ID", columnDefinition = "RAW(16)", updatable = false, nullable = false)
    private UUID settingId;

    @Column(name = "TENANT_ID", columnDefinition = "RAW(16)")
    private UUID tenantId;

    @Column(name = "SETTING_KEY", nullable = false, length = 200)
    private String settingKey;

    @Column(name = "SETTING_VALUE", nullable = false, length = 4000)
    private String settingValue;

    @Enumerated(EnumType.STRING)
    @Column(name = "VALUE_TYPE", nullable = false, length = 20)
    private SettingValueType valueType = SettingValueType.STRING;

    @Column(name = "DESCRIPTION", length = 500)
    private String description;

    @Column(name = "IS_SENSITIVE", nullable = false)
    private boolean sensitive;

    @Column(name = "CREATED_AT", updatable = false, nullable = false)
    private Instant createdAt;

    @Column(name = "UPDATED_AT", nullable = false)
    private Instant updatedAt;

    @Version
    @Column(name = "VERSION")
    private Long version;

    protected SystemSetting() {}

    public SystemSetting(UUID tenantId, String settingKey, String settingValue,
                         SettingValueType valueType, String description, boolean sensitive) {
        this.settingId = UUID.randomUUID();
        this.tenantId = tenantId;
        this.settingKey = settingKey;
        this.settingValue = settingValue;
        this.valueType = valueType;
        this.description = description;
        this.sensitive = sensitive;
        this.createdAt = Instant.now();
        this.updatedAt = Instant.now();
    }

    @PrePersist
    public void prePersist() {
        if (settingId == null) settingId = UUID.randomUUID();
        if (createdAt == null) createdAt = Instant.now();
        updatedAt = Instant.now();
    }

    @PreUpdate
    public void preUpdate() {
        updatedAt = Instant.now();
    }

    // Getters
    public UUID getSettingId() { return settingId; }
    public UUID getTenantId() { return tenantId; }
    public String getSettingKey() { return settingKey; }
    public String getSettingValue() { return settingValue; }
    public SettingValueType getValueType() { return valueType; }
    public String getDescription() { return description; }
    public boolean isSensitive() { return sensitive; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public Long getVersion() { return version; }

    // Setters
    public void setSettingValue(String settingValue) { this.settingValue = settingValue; }
    public void setDescription(String description) { this.description = description; }
}
