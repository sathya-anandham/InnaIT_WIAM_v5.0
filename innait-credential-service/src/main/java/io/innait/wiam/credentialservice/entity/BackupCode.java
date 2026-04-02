package io.innait.wiam.credentialservice.entity;

import io.innait.wiam.common.entity.BaseEntity;
import jakarta.persistence.*;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "BACKUP_CODES")
@AttributeOverride(name = "id", column = @Column(name = "BACKUP_CODE_ID", columnDefinition = "RAW(16)"))
public class BackupCode extends BaseEntity {

    @Column(name = "ACCOUNT_ID", columnDefinition = "RAW(16)", nullable = false)
    private UUID accountId;

    @Column(name = "CODE_HASH", nullable = false, length = 512)
    private String codeHash;

    @Column(name = "CODE_INDEX", nullable = false)
    private int codeIndex;

    @Enumerated(EnumType.STRING)
    @Column(name = "STATUS", nullable = false, length = 20)
    private BackupCodeStatus status = BackupCodeStatus.UNUSED;

    @Column(name = "USED_AT")
    private Instant usedAt;

    // Getters and setters

    public UUID getAccountId() { return accountId; }
    public void setAccountId(UUID accountId) { this.accountId = accountId; }

    public String getCodeHash() { return codeHash; }
    public void setCodeHash(String codeHash) { this.codeHash = codeHash; }

    public int getCodeIndex() { return codeIndex; }
    public void setCodeIndex(int codeIndex) { this.codeIndex = codeIndex; }

    public BackupCodeStatus getStatus() { return status; }
    public void setStatus(BackupCodeStatus status) { this.status = status; }

    public Instant getUsedAt() { return usedAt; }
    public void setUsedAt(Instant usedAt) { this.usedAt = usedAt; }
}
