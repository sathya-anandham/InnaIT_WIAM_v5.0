package io.innait.wiam.policyservice.entity;

import jakarta.persistence.*;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "AUTH_POLICIES")
public class AuthPolicy {

    @Id
    @Column(name = "AUTH_POLICY_ID", columnDefinition = "RAW(16)", updatable = false, nullable = false)
    private UUID authPolicyId;

    @Column(name = "TENANT_ID", columnDefinition = "RAW(16)", nullable = false, updatable = false)
    private UUID tenantId;

    @Column(name = "POLICY_NAME", length = 255, nullable = false)
    private String policyName;

    @Column(name = "DESCRIPTION", length = 1000)
    private String description;

    @Column(name = "PRIORITY", nullable = false)
    private int priority;

    @Column(name = "RULE_EXPRESSION", length = 4000, nullable = false)
    private String ruleExpression; // SpEL expression

    @Enumerated(EnumType.STRING)
    @Column(name = "ACTION", length = 30, nullable = false)
    private PolicyAction action;

    @Column(name = "MFA_REQUIRED", nullable = false)
    private boolean mfaRequired;

    @Column(name = "REQUIRED_AUTH_LEVEL", nullable = false)
    private int requiredAuthLevel;

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
        if (authPolicyId == null) authPolicyId = UUID.randomUUID();
        Instant now = Instant.now();
        createdAt = now;
        updatedAt = now;
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = Instant.now();
    }

    // Getters and setters

    public UUID getAuthPolicyId() { return authPolicyId; }
    public void setAuthPolicyId(UUID authPolicyId) { this.authPolicyId = authPolicyId; }

    public UUID getTenantId() { return tenantId; }
    public void setTenantId(UUID tenantId) { this.tenantId = tenantId; }

    public String getPolicyName() { return policyName; }
    public void setPolicyName(String policyName) { this.policyName = policyName; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public int getPriority() { return priority; }
    public void setPriority(int priority) { this.priority = priority; }

    public String getRuleExpression() { return ruleExpression; }
    public void setRuleExpression(String ruleExpression) { this.ruleExpression = ruleExpression; }

    public PolicyAction getAction() { return action; }
    public void setAction(PolicyAction action) { this.action = action; }

    public boolean isMfaRequired() { return mfaRequired; }
    public void setMfaRequired(boolean mfaRequired) { this.mfaRequired = mfaRequired; }

    public int getRequiredAuthLevel() { return requiredAuthLevel; }
    public void setRequiredAuthLevel(int requiredAuthLevel) { this.requiredAuthLevel = requiredAuthLevel; }

    public boolean isDefault() { return isDefault; }
    public void setDefault(boolean aDefault) { isDefault = aDefault; }

    public PolicyStatus getStatus() { return status; }
    public void setStatus(PolicyStatus status) { this.status = status; }

    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }

    public Long getVersion() { return version; }
    public void setVersion(Long version) { this.version = version; }
}
