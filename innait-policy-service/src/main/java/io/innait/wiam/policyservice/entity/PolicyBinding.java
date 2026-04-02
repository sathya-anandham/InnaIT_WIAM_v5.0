package io.innait.wiam.policyservice.entity;

import jakarta.persistence.*;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "POLICY_BINDINGS")
public class PolicyBinding {

    @Id
    @Column(name = "BINDING_ID", columnDefinition = "RAW(16)", updatable = false, nullable = false)
    private UUID bindingId;

    @Column(name = "TENANT_ID", columnDefinition = "RAW(16)", nullable = false, updatable = false)
    private UUID tenantId;

    @Enumerated(EnumType.STRING)
    @Column(name = "POLICY_TYPE", length = 30, nullable = false)
    private PolicyType policyType;

    @Column(name = "POLICY_ID", columnDefinition = "RAW(16)", nullable = false)
    private UUID policyId;

    @Enumerated(EnumType.STRING)
    @Column(name = "TARGET_TYPE", length = 30, nullable = false)
    private TargetType targetType;

    @Column(name = "TARGET_ID", columnDefinition = "RAW(16)", nullable = false)
    private UUID targetId;

    @Column(name = "IS_ACTIVE", nullable = false)
    private boolean active;

    @Column(name = "CREATED_AT", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "UPDATED_AT", nullable = false)
    private Instant updatedAt;

    @PrePersist
    protected void onCreate() {
        if (bindingId == null) bindingId = UUID.randomUUID();
        Instant now = Instant.now();
        createdAt = now;
        updatedAt = now;
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = Instant.now();
    }

    // Getters and setters

    public UUID getBindingId() { return bindingId; }
    public void setBindingId(UUID bindingId) { this.bindingId = bindingId; }

    public UUID getTenantId() { return tenantId; }
    public void setTenantId(UUID tenantId) { this.tenantId = tenantId; }

    public PolicyType getPolicyType() { return policyType; }
    public void setPolicyType(PolicyType policyType) { this.policyType = policyType; }

    public UUID getPolicyId() { return policyId; }
    public void setPolicyId(UUID policyId) { this.policyId = policyId; }

    public TargetType getTargetType() { return targetType; }
    public void setTargetType(TargetType targetType) { this.targetType = targetType; }

    public UUID getTargetId() { return targetId; }
    public void setTargetId(UUID targetId) { this.targetId = targetId; }

    public boolean isActive() { return active; }
    public void setActive(boolean active) { this.active = active; }

    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
}
