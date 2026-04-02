package io.innait.wiam.authorchestrator.entity;

import jakarta.persistence.*;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "AUTH_CHALLENGES")
public class AuthChallenge {

    @Id
    @Column(name = "CHALLENGE_ID", columnDefinition = "RAW(16)", updatable = false)
    private UUID challengeId;

    @Column(name = "AUTH_TXN_ID", columnDefinition = "RAW(16)", nullable = false)
    private UUID authTxnId;

    @Column(name = "TENANT_ID", columnDefinition = "RAW(16)", nullable = false)
    private UUID tenantId;

    @Enumerated(EnumType.STRING)
    @Column(name = "CHALLENGE_TYPE", nullable = false, length = 30)
    private ChallengeType challengeType;

    @Enumerated(EnumType.STRING)
    @Column(name = "CHALLENGE_STATUS", nullable = false, length = 20)
    private ChallengeStatus challengeStatus = ChallengeStatus.PENDING;

    @Lob
    @Column(name = "CHALLENGE_DATA")
    private String challengeData;

    @Column(name = "ATTEMPTS", nullable = false)
    private int attempts = 0;

    @Column(name = "MAX_ATTEMPTS", nullable = false)
    private int maxAttempts = 3;

    @Column(name = "ISSUED_AT", nullable = false)
    private Instant issuedAt;

    @Column(name = "EXPIRES_AT", nullable = false)
    private Instant expiresAt;

    @Column(name = "VERIFIED_AT")
    private Instant verifiedAt;

    @Column(name = "CREATED_AT", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "UPDATED_AT", nullable = false)
    private Instant updatedAt;

    @PrePersist
    protected void onCreate() {
        Instant now = Instant.now();
        if (this.challengeId == null) this.challengeId = UUID.randomUUID();
        if (this.issuedAt == null) this.issuedAt = now;
        if (this.createdAt == null) this.createdAt = now;
        this.updatedAt = now;
    }

    @PreUpdate
    protected void onUpdate() {
        this.updatedAt = Instant.now();
    }

    // Getters and setters

    public UUID getChallengeId() { return challengeId; }
    public void setChallengeId(UUID challengeId) { this.challengeId = challengeId; }

    public UUID getAuthTxnId() { return authTxnId; }
    public void setAuthTxnId(UUID authTxnId) { this.authTxnId = authTxnId; }

    public UUID getTenantId() { return tenantId; }
    public void setTenantId(UUID tenantId) { this.tenantId = tenantId; }

    public ChallengeType getChallengeType() { return challengeType; }
    public void setChallengeType(ChallengeType challengeType) { this.challengeType = challengeType; }

    public ChallengeStatus getChallengeStatus() { return challengeStatus; }
    public void setChallengeStatus(ChallengeStatus challengeStatus) { this.challengeStatus = challengeStatus; }

    public String getChallengeData() { return challengeData; }
    public void setChallengeData(String challengeData) { this.challengeData = challengeData; }

    public int getAttempts() { return attempts; }
    public void setAttempts(int attempts) { this.attempts = attempts; }

    public int getMaxAttempts() { return maxAttempts; }
    public void setMaxAttempts(int maxAttempts) { this.maxAttempts = maxAttempts; }

    public Instant getIssuedAt() { return issuedAt; }
    public void setIssuedAt(Instant issuedAt) { this.issuedAt = issuedAt; }

    public Instant getExpiresAt() { return expiresAt; }
    public void setExpiresAt(Instant expiresAt) { this.expiresAt = expiresAt; }

    public Instant getVerifiedAt() { return verifiedAt; }
    public void setVerifiedAt(Instant verifiedAt) { this.verifiedAt = verifiedAt; }

    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
}
