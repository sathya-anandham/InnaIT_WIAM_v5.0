package io.innait.wiam.authorchestrator.entity;

import io.innait.wiam.authorchestrator.statemachine.AuthState;
import jakarta.persistence.*;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "AUTH_TRANSACTIONS")
public class AuthTransaction {

    @Id
    @Column(name = "AUTH_TXN_ID", columnDefinition = "RAW(16)", updatable = false)
    private UUID authTxnId;

    @Column(name = "STARTED_AT", updatable = false)
    private Instant startedAt;

    @Column(name = "TENANT_ID", columnDefinition = "RAW(16)", nullable = false)
    private UUID tenantId;

    @Column(name = "ACCOUNT_ID", columnDefinition = "RAW(16)")
    private UUID accountId;

    @Column(name = "CORRELATION_ID", columnDefinition = "RAW(16)", nullable = false)
    private UUID correlationId;

    @Enumerated(EnumType.STRING)
    @Column(name = "CURRENT_STATE", nullable = false, length = 30)
    private AuthState currentState = AuthState.INITIATED;

    @Enumerated(EnumType.STRING)
    @Column(name = "CHANNEL_TYPE", nullable = false, length = 20)
    private ChannelType channelType = ChannelType.WEB;

    @Column(name = "CLIENT_IP", length = 45)
    private String clientIp;

    @Column(name = "USER_AGENT", length = 1000)
    private String userAgent;

    @Column(name = "RISK_SCORE")
    private Double riskScore;

    @Column(name = "DEVICE_CONTEXT_ID", columnDefinition = "RAW(16)")
    private UUID deviceContextId;

    @Column(name = "COMPLETED_AT")
    private Instant completedAt;

    @Column(name = "EXPIRES_AT", nullable = false)
    private Instant expiresAt;

    @Column(name = "CREATED_AT", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "UPDATED_AT", nullable = false)
    private Instant updatedAt;

    @PrePersist
    protected void onCreate() {
        Instant now = Instant.now();
        if (this.authTxnId == null) this.authTxnId = UUID.randomUUID();
        if (this.startedAt == null) this.startedAt = now;
        if (this.createdAt == null) this.createdAt = now;
        this.updatedAt = now;
    }

    @PreUpdate
    protected void onUpdate() {
        this.updatedAt = Instant.now();
    }

    // Getters and setters

    public UUID getAuthTxnId() { return authTxnId; }
    public void setAuthTxnId(UUID authTxnId) { this.authTxnId = authTxnId; }

    public Instant getStartedAt() { return startedAt; }
    public void setStartedAt(Instant startedAt) { this.startedAt = startedAt; }

    public UUID getTenantId() { return tenantId; }
    public void setTenantId(UUID tenantId) { this.tenantId = tenantId; }

    public UUID getAccountId() { return accountId; }
    public void setAccountId(UUID accountId) { this.accountId = accountId; }

    public UUID getCorrelationId() { return correlationId; }
    public void setCorrelationId(UUID correlationId) { this.correlationId = correlationId; }

    public AuthState getCurrentState() { return currentState; }
    public void setCurrentState(AuthState currentState) { this.currentState = currentState; }

    public ChannelType getChannelType() { return channelType; }
    public void setChannelType(ChannelType channelType) { this.channelType = channelType; }

    public String getClientIp() { return clientIp; }
    public void setClientIp(String clientIp) { this.clientIp = clientIp; }

    public String getUserAgent() { return userAgent; }
    public void setUserAgent(String userAgent) { this.userAgent = userAgent; }

    public Double getRiskScore() { return riskScore; }
    public void setRiskScore(Double riskScore) { this.riskScore = riskScore; }

    public UUID getDeviceContextId() { return deviceContextId; }
    public void setDeviceContextId(UUID deviceContextId) { this.deviceContextId = deviceContextId; }

    public Instant getCompletedAt() { return completedAt; }
    public void setCompletedAt(Instant completedAt) { this.completedAt = completedAt; }

    public Instant getExpiresAt() { return expiresAt; }
    public void setExpiresAt(Instant expiresAt) { this.expiresAt = expiresAt; }

    public Instant getCreatedAt() { return createdAt; }

    public Instant getUpdatedAt() { return updatedAt; }
}
