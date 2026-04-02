package io.innait.wiam.adminconfigservice.entity;

import jakarta.persistence.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.UUID;

/**
 * Top-level tenant entity. Standalone (not extending BaseEntity) because
 * the TENANT_ID IS the PK, not a FK to another tenant.
 */
@Entity
@Table(name = "TENANTS")
public class Tenant {

    @Id
    @Column(name = "TENANT_ID", columnDefinition = "RAW(16)", updatable = false, nullable = false)
    private UUID tenantId;

    @Column(name = "TENANT_CODE", nullable = false, length = 50, unique = true)
    private String tenantCode;

    @Column(name = "TENANT_NAME", nullable = false, length = 255)
    private String tenantName;

    @Enumerated(EnumType.STRING)
    @Column(name = "STATUS", nullable = false, length = 20)
    private TenantStatus status = TenantStatus.ACTIVE;

    @JdbcTypeCode(SqlTypes.CLOB)
    @Column(name = "BRANDING_CONFIG")
    private String brandingConfig = "{}";

    @Enumerated(EnumType.STRING)
    @Column(name = "SUBSCRIPTION_TIER", nullable = false, length = 30)
    private SubscriptionTier subscriptionTier = SubscriptionTier.STANDARD;

    @Column(name = "CREATED_AT", updatable = false, nullable = false)
    private Instant createdAt;

    @Column(name = "UPDATED_AT", nullable = false)
    private Instant updatedAt;

    @Version
    @Column(name = "VERSION")
    private Long version;

    protected Tenant() {}

    public Tenant(UUID tenantId, String tenantCode, String tenantName,
                  SubscriptionTier subscriptionTier) {
        this.tenantId = tenantId;
        this.tenantCode = tenantCode;
        this.tenantName = tenantName;
        this.subscriptionTier = subscriptionTier;
        this.status = TenantStatus.PENDING_SETUP;
        this.createdAt = Instant.now();
        this.updatedAt = Instant.now();
    }

    @PrePersist
    public void prePersist() {
        if (tenantId == null) tenantId = UUID.randomUUID();
        if (createdAt == null) createdAt = Instant.now();
        updatedAt = Instant.now();
    }

    @PreUpdate
    public void preUpdate() {
        updatedAt = Instant.now();
    }

    // Getters
    public UUID getTenantId() { return tenantId; }
    public String getTenantCode() { return tenantCode; }
    public String getTenantName() { return tenantName; }
    public TenantStatus getStatus() { return status; }
    public String getBrandingConfig() { return brandingConfig; }
    public SubscriptionTier getSubscriptionTier() { return subscriptionTier; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public Long getVersion() { return version; }

    // Setters
    public void setTenantName(String tenantName) { this.tenantName = tenantName; }
    public void setStatus(TenantStatus status) { this.status = status; }
    public void setBrandingConfig(String brandingConfig) { this.brandingConfig = brandingConfig; }
    public void setSubscriptionTier(SubscriptionTier subscriptionTier) { this.subscriptionTier = subscriptionTier; }

    public void activate() {
        this.status = TenantStatus.ACTIVE;
    }

    public void suspend() {
        this.status = TenantStatus.SUSPENDED;
    }

    public void deactivate() {
        this.status = TenantStatus.INACTIVE;
    }
}
