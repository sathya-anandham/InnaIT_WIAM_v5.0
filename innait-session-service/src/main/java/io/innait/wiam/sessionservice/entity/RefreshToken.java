package io.innait.wiam.sessionservice.entity;

import jakarta.persistence.*;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "REFRESH_TOKENS")
public class RefreshToken {

    @Id
    @Column(name = "REFRESH_TOKEN_ID", columnDefinition = "RAW(16)", updatable = false, nullable = false)
    private UUID refreshTokenId;

    @Column(name = "SESSION_ID", columnDefinition = "RAW(16)", nullable = false)
    private UUID sessionId;

    @Column(name = "TENANT_ID", columnDefinition = "RAW(16)", nullable = false)
    private UUID tenantId;

    @Column(name = "TOKEN_HASH", length = 512, nullable = false, unique = true)
    private String tokenHash;

    @Column(name = "TOKEN_FAMILY", columnDefinition = "RAW(16)", nullable = false)
    private UUID tokenFamily;

    @Column(name = "IS_USED", nullable = false)
    private boolean used;

    @Column(name = "ISSUED_AT", nullable = false, updatable = false)
    private Instant issuedAt;

    @Column(name = "EXPIRES_AT", nullable = false)
    private Instant expiresAt;

    @Column(name = "USED_AT")
    private Instant usedAt;

    @Column(name = "REVOKED_AT")
    private Instant revokedAt;

    @Column(name = "CREATED_AT", nullable = false, updatable = false)
    private Instant createdAt;

    @PrePersist
    protected void onCreate() {
        if (refreshTokenId == null) refreshTokenId = UUID.randomUUID();
        Instant now = Instant.now();
        if (issuedAt == null) issuedAt = now;
        createdAt = now;
    }

    // Getters and setters

    public UUID getRefreshTokenId() { return refreshTokenId; }
    public void setRefreshTokenId(UUID refreshTokenId) { this.refreshTokenId = refreshTokenId; }

    public UUID getSessionId() { return sessionId; }
    public void setSessionId(UUID sessionId) { this.sessionId = sessionId; }

    public UUID getTenantId() { return tenantId; }
    public void setTenantId(UUID tenantId) { this.tenantId = tenantId; }

    public String getTokenHash() { return tokenHash; }
    public void setTokenHash(String tokenHash) { this.tokenHash = tokenHash; }

    public UUID getTokenFamily() { return tokenFamily; }
    public void setTokenFamily(UUID tokenFamily) { this.tokenFamily = tokenFamily; }

    public boolean isUsed() { return used; }
    public void setUsed(boolean used) { this.used = used; }

    public Instant getIssuedAt() { return issuedAt; }
    public void setIssuedAt(Instant issuedAt) { this.issuedAt = issuedAt; }

    public Instant getExpiresAt() { return expiresAt; }
    public void setExpiresAt(Instant expiresAt) { this.expiresAt = expiresAt; }

    public Instant getUsedAt() { return usedAt; }
    public void setUsedAt(Instant usedAt) { this.usedAt = usedAt; }

    public Instant getRevokedAt() { return revokedAt; }
    public void setRevokedAt(Instant revokedAt) { this.revokedAt = revokedAt; }

    public Instant getCreatedAt() { return createdAt; }
}
