package io.innait.wiam.credentialservice.entity;

import io.innait.wiam.common.constant.CredentialStatus;
import io.innait.wiam.common.entity.BaseEntity;
import jakarta.persistence.*;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "PASSWORD_CREDENTIALS")
@AttributeOverride(name = "id", column = @Column(name = "PASSWORD_CRED_ID", columnDefinition = "RAW(16)"))
public class PasswordCredential extends BaseEntity {

    @Column(name = "ACCOUNT_ID", columnDefinition = "RAW(16)", nullable = false)
    private UUID accountId;

    @Column(name = "PASSWORD_HASH", nullable = false, length = 512)
    private String passwordHash;

    @Enumerated(EnumType.STRING)
    @Column(name = "HASH_ALGORITHM", nullable = false, length = 30)
    private HashAlgorithm hashAlgorithm = HashAlgorithm.ARGON2ID;

    @Column(name = "SALT", length = 128)
    private String salt;

    @Column(name = "IS_ACTIVE", nullable = false)
    private boolean active = true;

    @Column(name = "MUST_CHANGE", nullable = false)
    private boolean mustChange = false;

    @Enumerated(EnumType.STRING)
    @Column(name = "CREDENTIAL_STATUS", nullable = false, length = 20)
    private CredentialStatus credentialStatus = CredentialStatus.ACTIVE;

    @Column(name = "EXPIRES_AT")
    private Instant expiresAt;

    // Getters and setters

    public UUID getAccountId() { return accountId; }
    public void setAccountId(UUID accountId) { this.accountId = accountId; }

    public String getPasswordHash() { return passwordHash; }
    public void setPasswordHash(String passwordHash) { this.passwordHash = passwordHash; }

    public HashAlgorithm getHashAlgorithm() { return hashAlgorithm; }
    public void setHashAlgorithm(HashAlgorithm hashAlgorithm) { this.hashAlgorithm = hashAlgorithm; }

    public String getSalt() { return salt; }
    public void setSalt(String salt) { this.salt = salt; }

    public boolean isActive() { return active; }
    public void setActive(boolean active) { this.active = active; }

    public boolean isMustChange() { return mustChange; }
    public void setMustChange(boolean mustChange) { this.mustChange = mustChange; }

    public CredentialStatus getCredentialStatus() { return credentialStatus; }
    public void setCredentialStatus(CredentialStatus credentialStatus) { this.credentialStatus = credentialStatus; }

    public Instant getExpiresAt() { return expiresAt; }
    public void setExpiresAt(Instant expiresAt) { this.expiresAt = expiresAt; }
}
