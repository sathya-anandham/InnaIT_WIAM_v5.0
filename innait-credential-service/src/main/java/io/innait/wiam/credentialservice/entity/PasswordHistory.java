package io.innait.wiam.credentialservice.entity;

import io.innait.wiam.common.entity.BaseEntity;
import jakarta.persistence.*;

import java.util.UUID;

@Entity
@Table(name = "PASSWORD_HISTORY")
@AttributeOverride(name = "id", column = @Column(name = "PASSWORD_HISTORY_ID", columnDefinition = "RAW(16)"))
public class PasswordHistory extends BaseEntity {

    @Column(name = "ACCOUNT_ID", columnDefinition = "RAW(16)", nullable = false)
    private UUID accountId;

    @Column(name = "PASSWORD_HASH", nullable = false, length = 512)
    private String passwordHash;

    @Enumerated(EnumType.STRING)
    @Column(name = "HASH_ALGORITHM", nullable = false, length = 30)
    private HashAlgorithm hashAlgorithm = HashAlgorithm.ARGON2ID;

    public UUID getAccountId() { return accountId; }
    public void setAccountId(UUID accountId) { this.accountId = accountId; }

    public String getPasswordHash() { return passwordHash; }
    public void setPasswordHash(String passwordHash) { this.passwordHash = passwordHash; }

    public HashAlgorithm getHashAlgorithm() { return hashAlgorithm; }
    public void setHashAlgorithm(HashAlgorithm hashAlgorithm) { this.hashAlgorithm = hashAlgorithm; }
}
