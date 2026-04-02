package io.innait.wiam.authorchestrator.entity;

import jakarta.persistence.*;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "AUTH_RESULTS")
public class AuthResult {

    @Id
    @Column(name = "AUTH_RESULT_ID", columnDefinition = "RAW(16)", updatable = false)
    private UUID authResultId;

    @Column(name = "AUTH_TXN_ID", columnDefinition = "RAW(16)", nullable = false)
    private UUID authTxnId;

    @Column(name = "TENANT_ID", columnDefinition = "RAW(16)", nullable = false)
    private UUID tenantId;

    @Enumerated(EnumType.STRING)
    @Column(name = "RESULT", nullable = false, length = 20)
    private AuthResultType result;

    @Lob
    @Column(name = "AUTH_METHODS_USED")
    private String authMethodsUsed = "[]";

    @Column(name = "FAILURE_REASON", length = 100)
    private String failureReason;

    @Column(name = "SESSION_ID", columnDefinition = "RAW(16)")
    private UUID sessionId;

    @Column(name = "CREATED_AT", nullable = false, updatable = false)
    private Instant createdAt;

    @PrePersist
    protected void onCreate() {
        if (this.authResultId == null) this.authResultId = UUID.randomUUID();
        if (this.createdAt == null) this.createdAt = Instant.now();
    }

    // Getters and setters

    public UUID getAuthResultId() { return authResultId; }
    public void setAuthResultId(UUID authResultId) { this.authResultId = authResultId; }

    public UUID getAuthTxnId() { return authTxnId; }
    public void setAuthTxnId(UUID authTxnId) { this.authTxnId = authTxnId; }

    public UUID getTenantId() { return tenantId; }
    public void setTenantId(UUID tenantId) { this.tenantId = tenantId; }

    public AuthResultType getResult() { return result; }
    public void setResult(AuthResultType result) { this.result = result; }

    public String getAuthMethodsUsed() { return authMethodsUsed; }
    public void setAuthMethodsUsed(String authMethodsUsed) { this.authMethodsUsed = authMethodsUsed; }

    public String getFailureReason() { return failureReason; }
    public void setFailureReason(String failureReason) { this.failureReason = failureReason; }

    public UUID getSessionId() { return sessionId; }
    public void setSessionId(UUID sessionId) { this.sessionId = sessionId; }

    public Instant getCreatedAt() { return createdAt; }
}
