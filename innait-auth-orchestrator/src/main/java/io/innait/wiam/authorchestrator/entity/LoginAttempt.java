package io.innait.wiam.authorchestrator.entity;

import jakarta.persistence.*;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "LOGIN_ATTEMPTS")
@IdClass(LoginAttemptId.class)
public class LoginAttempt {

    @Id
    @Column(name = "ATTEMPT_ID", columnDefinition = "RAW(16)", updatable = false)
    private UUID attemptId;

    @Id
    @Column(name = "TENANT_ID", columnDefinition = "RAW(16)", updatable = false)
    private UUID tenantId;

    @Column(name = "ACCOUNT_ID", columnDefinition = "RAW(16)")
    private UUID accountId;

    @Column(name = "LOGIN_ID", length = 320)
    private String loginId;

    @Column(name = "CLIENT_IP", nullable = false, length = 45)
    private String clientIp;

    @Column(name = "USER_AGENT", length = 1000)
    private String userAgent;

    @Enumerated(EnumType.STRING)
    @Column(name = "ATTEMPT_STATUS", nullable = false, length = 20)
    private AttemptStatus attemptStatus;

    @Column(name = "FAILURE_REASON", length = 100)
    private String failureReason;

    @Column(name = "ATTEMPTED_AT", nullable = false)
    private Instant attemptedAt;

    @PrePersist
    protected void onCreate() {
        if (this.attemptId == null) this.attemptId = UUID.randomUUID();
        if (this.attemptedAt == null) this.attemptedAt = Instant.now();
    }

    // Getters and setters

    public UUID getAttemptId() { return attemptId; }
    public void setAttemptId(UUID attemptId) { this.attemptId = attemptId; }

    public UUID getTenantId() { return tenantId; }
    public void setTenantId(UUID tenantId) { this.tenantId = tenantId; }

    public UUID getAccountId() { return accountId; }
    public void setAccountId(UUID accountId) { this.accountId = accountId; }

    public String getLoginId() { return loginId; }
    public void setLoginId(String loginId) { this.loginId = loginId; }

    public String getClientIp() { return clientIp; }
    public void setClientIp(String clientIp) { this.clientIp = clientIp; }

    public String getUserAgent() { return userAgent; }
    public void setUserAgent(String userAgent) { this.userAgent = userAgent; }

    public AttemptStatus getAttemptStatus() { return attemptStatus; }
    public void setAttemptStatus(AttemptStatus attemptStatus) { this.attemptStatus = attemptStatus; }

    public String getFailureReason() { return failureReason; }
    public void setFailureReason(String failureReason) { this.failureReason = failureReason; }

    public Instant getAttemptedAt() { return attemptedAt; }
    public void setAttemptedAt(Instant attemptedAt) { this.attemptedAt = attemptedAt; }
}
