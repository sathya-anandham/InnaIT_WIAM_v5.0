package io.innait.wiam.identityservice.entity;

import io.innait.wiam.common.constant.AccountStatus;
import io.innait.wiam.common.entity.SoftDeletableEntity;
import jakarta.persistence.AttributeOverride;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.Table;
import org.hibernate.annotations.SQLRestriction;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "ACCOUNTS")
@AttributeOverride(name = "id", column = @Column(name = "ACCOUNT_ID", columnDefinition = "RAW(16)"))
@SQLRestriction("IS_DELETED = 0")
public class Account extends SoftDeletableEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "USER_ID", nullable = false, updatable = false)
    private User user;

    @Column(name = "LOGIN_ID", nullable = false, length = 320)
    private String loginId;

    @Enumerated(EnumType.STRING)
    @Column(name = "ACCOUNT_STATUS", nullable = false, length = 30)
    private AccountStatus accountStatus;

    @Column(name = "IS_PASSWORD_ENABLED", nullable = false)
    private boolean passwordEnabled = true;

    @Column(name = "IS_FIDO_ENABLED", nullable = false)
    private boolean fidoEnabled = false;

    @Column(name = "IS_TOTP_ENABLED", nullable = false)
    private boolean totpEnabled = false;

    @Column(name = "IS_SOFTTOKEN_ENABLED", nullable = false)
    private boolean softtokenEnabled = false;

    @Column(name = "FAILED_ATTEMPT_COUNT", nullable = false)
    private int failedAttemptCount = 0;

    @Column(name = "LOCKED_UNTIL")
    private Instant lockedUntil;

    @Column(name = "LAST_LOGIN_AT")
    private Instant lastLoginAt;

    @Column(name = "LAST_LOGIN_IP", length = 50)
    private String lastLoginIp;

    @Column(name = "PASSWORD_CHANGED_AT")
    private Instant passwordChangedAt;

    @Column(name = "MUST_CHANGE_PASSWORD", nullable = false)
    private boolean mustChangePassword = false;

    @OneToMany(mappedBy = "account", fetch = FetchType.LAZY)
    private List<AccountRoleMap> accountRoleMaps = new ArrayList<>();

    @OneToMany(mappedBy = "account", fetch = FetchType.LAZY)
    private List<AccountGroupMap> accountGroupMaps = new ArrayList<>();

    // Getters and setters

    public User getUser() { return user; }
    public void setUser(User user) { this.user = user; }

    public String getLoginId() { return loginId; }
    public void setLoginId(String loginId) { this.loginId = loginId; }

    public AccountStatus getAccountStatus() { return accountStatus; }
    public void setAccountStatus(AccountStatus accountStatus) { this.accountStatus = accountStatus; }

    public boolean isPasswordEnabled() { return passwordEnabled; }
    public void setPasswordEnabled(boolean passwordEnabled) { this.passwordEnabled = passwordEnabled; }

    public boolean isFidoEnabled() { return fidoEnabled; }
    public void setFidoEnabled(boolean fidoEnabled) { this.fidoEnabled = fidoEnabled; }

    public boolean isTotpEnabled() { return totpEnabled; }
    public void setTotpEnabled(boolean totpEnabled) { this.totpEnabled = totpEnabled; }

    public boolean isSofttokenEnabled() { return softtokenEnabled; }
    public void setSofttokenEnabled(boolean softtokenEnabled) { this.softtokenEnabled = softtokenEnabled; }

    public int getFailedAttemptCount() { return failedAttemptCount; }
    public void setFailedAttemptCount(int failedAttemptCount) { this.failedAttemptCount = failedAttemptCount; }

    public Instant getLockedUntil() { return lockedUntil; }
    public void setLockedUntil(Instant lockedUntil) { this.lockedUntil = lockedUntil; }

    public Instant getLastLoginAt() { return lastLoginAt; }
    public void setLastLoginAt(Instant lastLoginAt) { this.lastLoginAt = lastLoginAt; }

    public String getLastLoginIp() { return lastLoginIp; }
    public void setLastLoginIp(String lastLoginIp) { this.lastLoginIp = lastLoginIp; }

    public Instant getPasswordChangedAt() { return passwordChangedAt; }
    public void setPasswordChangedAt(Instant passwordChangedAt) { this.passwordChangedAt = passwordChangedAt; }

    public boolean isMustChangePassword() { return mustChangePassword; }
    public void setMustChangePassword(boolean mustChangePassword) { this.mustChangePassword = mustChangePassword; }

    public List<AccountRoleMap> getAccountRoleMaps() { return accountRoleMaps; }
    public void setAccountRoleMaps(List<AccountRoleMap> accountRoleMaps) { this.accountRoleMaps = accountRoleMaps; }

    public List<AccountGroupMap> getAccountGroupMaps() { return accountGroupMaps; }
    public void setAccountGroupMaps(List<AccountGroupMap> accountGroupMaps) { this.accountGroupMaps = accountGroupMaps; }
}
