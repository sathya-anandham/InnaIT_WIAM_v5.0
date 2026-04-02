package io.innait.wiam.sessionservice.entity;

import jakarta.persistence.*;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "SESSIONS")
public class Session {

    @Id
    @Column(name = "SESSION_ID", columnDefinition = "RAW(16)", updatable = false, nullable = false)
    private UUID sessionId;

    @Column(name = "TENANT_ID", columnDefinition = "RAW(16)", nullable = false, updatable = false)
    private UUID tenantId;

    @Column(name = "ACCOUNT_ID", columnDefinition = "RAW(16)", nullable = false)
    private UUID accountId;

    @Enumerated(EnumType.STRING)
    @Column(name = "SESSION_TYPE", length = 20, nullable = false)
    private SessionType sessionType;

    @Enumerated(EnumType.STRING)
    @Column(name = "SESSION_STATUS", length = 20, nullable = false)
    private SessionStatus sessionStatus;

    @Column(name = "AUTH_TXN_ID", columnDefinition = "RAW(16)")
    private UUID authTxnId;

    @Column(name = "AUTH_LEVEL", nullable = false)
    private int authLevel;

    @Column(name = "STARTED_AT", nullable = false, updatable = false)
    private Instant startedAt;

    @Column(name = "LAST_ACTIVITY_AT", nullable = false)
    private Instant lastActivityAt;

    @Column(name = "EXPIRES_AT", nullable = false)
    private Instant expiresAt;

    @Column(name = "TERMINATED_AT")
    private Instant terminatedAt;

    @Column(name = "TERMINATION_REASON", length = 50)
    private String terminationReason;

    @Column(name = "CREATED_AT", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "UPDATED_AT", nullable = false)
    private Instant updatedAt;

    @Version
    @Column(name = "VERSION")
    private Long version;

    @PrePersist
    protected void onCreate() {
        if (sessionId == null) sessionId = UUID.randomUUID();
        Instant now = Instant.now();
        if (startedAt == null) startedAt = now;
        if (lastActivityAt == null) lastActivityAt = now;
        createdAt = now;
        updatedAt = now;
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = Instant.now();
    }

    // Getters and setters

    public UUID getSessionId() { return sessionId; }
    public void setSessionId(UUID sessionId) { this.sessionId = sessionId; }

    public UUID getTenantId() { return tenantId; }
    public void setTenantId(UUID tenantId) { this.tenantId = tenantId; }

    public UUID getAccountId() { return accountId; }
    public void setAccountId(UUID accountId) { this.accountId = accountId; }

    public SessionType getSessionType() { return sessionType; }
    public void setSessionType(SessionType sessionType) { this.sessionType = sessionType; }

    public SessionStatus getSessionStatus() { return sessionStatus; }
    public void setSessionStatus(SessionStatus sessionStatus) { this.sessionStatus = sessionStatus; }

    public UUID getAuthTxnId() { return authTxnId; }
    public void setAuthTxnId(UUID authTxnId) { this.authTxnId = authTxnId; }

    public int getAuthLevel() { return authLevel; }
    public void setAuthLevel(int authLevel) { this.authLevel = authLevel; }

    public Instant getStartedAt() { return startedAt; }
    public void setStartedAt(Instant startedAt) { this.startedAt = startedAt; }

    public Instant getLastActivityAt() { return lastActivityAt; }
    public void setLastActivityAt(Instant lastActivityAt) { this.lastActivityAt = lastActivityAt; }

    public Instant getExpiresAt() { return expiresAt; }
    public void setExpiresAt(Instant expiresAt) { this.expiresAt = expiresAt; }

    public Instant getTerminatedAt() { return terminatedAt; }
    public void setTerminatedAt(Instant terminatedAt) { this.terminatedAt = terminatedAt; }

    public String getTerminationReason() { return terminationReason; }
    public void setTerminationReason(String terminationReason) { this.terminationReason = terminationReason; }

    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }

    public Long getVersion() { return version; }
    public void setVersion(Long version) { this.version = version; }
}
