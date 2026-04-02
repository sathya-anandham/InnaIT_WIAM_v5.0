package io.innait.wiam.policyservice.entity;

import jakarta.persistence.*;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "MFA_POLICIES")
public class MfaPolicy {

    @Id
    @Column(name = "MFA_POLICY_ID", columnDefinition = "RAW(16)", updatable = false, nullable = false)
    private UUID mfaPolicyId;

    @Column(name = "TENANT_ID", columnDefinition = "RAW(16)", nullable = false, updatable = false)
    private UUID tenantId;

    @Column(name = "POLICY_NAME", length = 255, nullable = false)
    private String policyName;

    @Enumerated(EnumType.STRING)
    @Column(name = "ENFORCEMENT_MODE", length = 20, nullable = false)
    private EnforcementMode enforcementMode;

    @Column(name = "ALLOWED_METHODS", columnDefinition = "CLOB")
    private String allowedMethods; // JSON array stored as string

    @Column(name = "REMEMBER_DEVICE_DAYS", nullable = false)
    private int rememberDeviceDays;

    @Column(name = "GRACE_PERIOD_DAYS", nullable = false)
    private int gracePeriodDays;

    @Column(name = "IS_DEFAULT", nullable = false)
    private boolean isDefault;

    @Enumerated(EnumType.STRING)
    @Column(name = "STATUS", length = 20, nullable = false)
    private PolicyStatus status;

    @Column(name = "CREATED_AT", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "UPDATED_AT", nullable = false)
    private Instant updatedAt;

    @Version
    @Column(name = "VERSION")
    private Long version;

    @PrePersist
    protected void onCreate() {
        if (mfaPolicyId == null) mfaPolicyId = UUID.randomUUID();
        Instant now = Instant.now();
        createdAt = now;
        updatedAt = now;
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = Instant.now();
    }

    // Getters and setters

    public UUID getMfaPolicyId() { return mfaPolicyId; }
    public void setMfaPolicyId(UUID mfaPolicyId) { this.mfaPolicyId = mfaPolicyId; }

    public UUID getTenantId() { return tenantId; }
    public void setTenantId(UUID tenantId) { this.tenantId = tenantId; }

    public String getPolicyName() { return policyName; }
    public void setPolicyName(String policyName) { this.policyName = policyName; }

    public EnforcementMode getEnforcementMode() { return enforcementMode; }
    public void setEnforcementMode(EnforcementMode enforcementMode) { this.enforcementMode = enforcementMode; }

    public String getAllowedMethods() { return allowedMethods; }
    public void setAllowedMethods(String allowedMethods) { this.allowedMethods = allowedMethods; }

    public int getRememberDeviceDays() { return rememberDeviceDays; }
    public void setRememberDeviceDays(int rememberDeviceDays) { this.rememberDeviceDays = rememberDeviceDays; }

    public int getGracePeriodDays() { return gracePeriodDays; }
    public void setGracePeriodDays(int gracePeriodDays) { this.gracePeriodDays = gracePeriodDays; }

    public boolean isDefault() { return isDefault; }
    public void setDefault(boolean aDefault) { isDefault = aDefault; }

    public PolicyStatus getStatus() { return status; }
    public void setStatus(PolicyStatus status) { this.status = status; }

    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }

    public Long getVersion() { return version; }
    public void setVersion(Long version) { this.version = version; }
}
