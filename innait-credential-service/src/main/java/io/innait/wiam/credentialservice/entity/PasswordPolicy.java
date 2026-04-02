package io.innait.wiam.credentialservice.entity;

import io.innait.wiam.common.entity.BaseEntity;
import jakarta.persistence.*;

@Entity
@Table(name = "PASSWORD_POLICIES")
@AttributeOverride(name = "id", column = @Column(name = "PASSWORD_POLICY_ID", columnDefinition = "RAW(16)"))
public class PasswordPolicy extends BaseEntity {

    @Column(name = "POLICY_NAME", nullable = false, length = 100)
    private String policyName;

    @Column(name = "MIN_LENGTH", nullable = false)
    private int minLength = 8;

    @Column(name = "MAX_LENGTH", nullable = false)
    private int maxLength = 128;

    @Column(name = "REQUIRE_UPPERCASE", nullable = false)
    private boolean requireUppercase = true;

    @Column(name = "REQUIRE_LOWERCASE", nullable = false)
    private boolean requireLowercase = true;

    @Column(name = "REQUIRE_DIGIT", nullable = false)
    private boolean requireDigit = true;

    @Column(name = "REQUIRE_SPECIAL", nullable = false)
    private boolean requireSpecial = true;

    @Column(name = "HISTORY_COUNT", nullable = false)
    private int historyCount = 5;

    @Column(name = "MAX_AGE_DAYS", nullable = false)
    private int maxAgeDays = 90;

    @Column(name = "LOCKOUT_THRESHOLD", nullable = false)
    private int lockoutThreshold = 5;

    @Column(name = "LOCKOUT_DURATION_MIN", nullable = false)
    private int lockoutDurationMin = 30;

    @Column(name = "IS_DEFAULT", nullable = false)
    private boolean isDefault = false;

    // Getters and setters

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

    public int getHistoryCount() { return historyCount; }
    public void setHistoryCount(int historyCount) { this.historyCount = historyCount; }

    public int getMaxAgeDays() { return maxAgeDays; }
    public void setMaxAgeDays(int maxAgeDays) { this.maxAgeDays = maxAgeDays; }

    public int getLockoutThreshold() { return lockoutThreshold; }
    public void setLockoutThreshold(int lockoutThreshold) { this.lockoutThreshold = lockoutThreshold; }

    public int getLockoutDurationMin() { return lockoutDurationMin; }
    public void setLockoutDurationMin(int lockoutDurationMin) { this.lockoutDurationMin = lockoutDurationMin; }

    public boolean isDefault() { return isDefault; }
    public void setDefault(boolean aDefault) { isDefault = aDefault; }
}
