package io.innait.wiam.policyservice.entity;

import jakarta.persistence.*;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "PASSWORD_POLICIES")
public class PasswordPolicy {

    @Id
    @Column(name = "PASSWORD_POLICY_ID", columnDefinition = "RAW(16)", updatable = false, nullable = false)
    private UUID passwordPolicyId;

    @Column(name = "TENANT_ID", columnDefinition = "RAW(16)", nullable = false, updatable = false)
    private UUID tenantId;

    @Column(name = "POLICY_NAME", length = 255, nullable = false)
    private String policyName;

    @Column(name = "MIN_LENGTH", nullable = false)
    private int minLength;

    @Column(name = "MAX_LENGTH", nullable = false)
    private int maxLength;

    @Column(name = "REQUIRE_UPPERCASE", nullable = false)
    private boolean requireUppercase;

    @Column(name = "REQUIRE_LOWERCASE", nullable = false)
    private boolean requireLowercase;

    @Column(name = "REQUIRE_DIGIT", nullable = false)
    private boolean requireDigit;

    @Column(name = "REQUIRE_SPECIAL", nullable = false)
    private boolean requireSpecial;

    @Column(name = "MAX_REPEATED_CHARS", nullable = false)
    private int maxRepeatedChars;

    @Column(name = "HISTORY_COUNT", nullable = false)
    private int historyCount;

    @Column(name = "MAX_AGE_DAYS", nullable = false)
    private int maxAgeDays;

    @Column(name = "MIN_AGE_DAYS", nullable = false)
    private int minAgeDays;

    @Column(name = "LOCKOUT_THRESHOLD", nullable = false)
    private int lockoutThreshold;

    @Column(name = "LOCKOUT_DURATION_MIN", nullable = false)
    private int lockoutDurationMin;

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
        if (passwordPolicyId == null) passwordPolicyId = UUID.randomUUID();
        Instant now = Instant.now();
        createdAt = now;
        updatedAt = now;
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = Instant.now();
    }

    // Getters and setters

    public UUID getPasswordPolicyId() { return passwordPolicyId; }
    public void setPasswordPolicyId(UUID passwordPolicyId) { this.passwordPolicyId = passwordPolicyId; }

    public UUID getTenantId() { return tenantId; }
    public void setTenantId(UUID tenantId) { this.tenantId = tenantId; }

    public String getPolicyName() { return policyName; }
    public void setPolicyName(String policyName) { this.policyName = policyName; }

    public int getMinLength() { return minLength; }
    public void setMinLength(int minLength) { this.minLength = minLength; }

    public int getMaxLength() { return maxLength; }
    public void setMaxLength(int maxLength) { this.maxLength = maxLength; }

    public boolean isRequireUppercase() { return requireUppercase; }
    public void setRequireUppercase(boolean requireUppercase) { this.requireUppercase = requireUppercase; }

    public boolean isRequireLowercase() { return requireLowercase; }
    public void setRequireLowercase(boolean requireLowercase) { this.requireLowercase = requireLowercase; }

    public boolean isRequireDigit() { return requireDigit; }
    public void setRequireDigit(boolean requireDigit) { this.requireDigit = requireDigit; }

    public boolean isRequireSpecial() { return requireSpecial; }
    public void setRequireSpecial(boolean requireSpecial) { this.requireSpecial = requireSpecial; }

    public int getMaxRepeatedChars() { return maxRepeatedChars; }
    public void setMaxRepeatedChars(int maxRepeatedChars) { this.maxRepeatedChars = maxRepeatedChars; }

    public int getHistoryCount() { return historyCount; }
    public void setHistoryCount(int historyCount) { this.historyCount = historyCount; }

    public int getMaxAgeDays() { return maxAgeDays; }
    public void setMaxAgeDays(int maxAgeDays) { this.maxAgeDays = maxAgeDays; }

    public int getMinAgeDays() { return minAgeDays; }
    public void setMinAgeDays(int minAgeDays) { this.minAgeDays = minAgeDays; }

    public int getLockoutThreshold() { return lockoutThreshold; }
    public void setLockoutThreshold(int lockoutThreshold) { this.lockoutThreshold = lockoutThreshold; }

    public int getLockoutDurationMin() { return lockoutDurationMin; }
    public void setLockoutDurationMin(int lockoutDurationMin) { this.lockoutDurationMin = lockoutDurationMin; }

    public boolean isDefault() { return isDefault; }
    public void setDefault(boolean aDefault) { isDefault = aDefault; }

    public PolicyStatus getStatus() { return status; }
    public void setStatus(PolicyStatus status) { this.status = status; }

    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }

    public Long getVersion() { return version; }
    public void setVersion(Long version) { this.version = version; }
}
