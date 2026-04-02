package io.innait.wiam.credentialservice.entity;

import io.innait.wiam.common.constant.CredentialStatus;
import io.innait.wiam.common.entity.BaseEntity;
import jakarta.persistence.*;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "FIDO_CREDENTIALS")
@AttributeOverride(name = "id", column = @Column(name = "FIDO_CRED_ID", columnDefinition = "RAW(16)"))
public class FidoCredential extends BaseEntity {

    @Column(name = "ACCOUNT_ID", columnDefinition = "RAW(16)", nullable = false)
    private UUID accountId;

    @Column(name = "CREDENTIAL_ID", nullable = false, length = 1024)
    private String credentialId;

    @Lob
    @Column(name = "PUBLIC_KEY_COSE", nullable = false)
    private byte[] publicKeyCose;

    @Column(name = "AAGUID", columnDefinition = "RAW(16)")
    private UUID aaguid;

    @Column(name = "SIGN_COUNT", nullable = false)
    private long signCount = 0;

    @Column(name = "BACKUP_ELIGIBLE", nullable = false)
    private boolean backupEligible = false;

    @Column(name = "BACKUP_STATE", nullable = false)
    private boolean backupState = false;

    @Column(name = "DISPLAY_NAME", length = 255)
    private String displayName;

    @Enumerated(EnumType.STRING)
    @Column(name = "CREDENTIAL_STATUS", nullable = false, length = 20)
    private CredentialStatus credentialStatus = CredentialStatus.ACTIVE;

    @Column(name = "LAST_USED_AT")
    private Instant lastUsedAt;

    // Getters and setters

    public UUID getAccountId() { return accountId; }
    public void setAccountId(UUID accountId) { this.accountId = accountId; }

    public String getCredentialId() { return credentialId; }
    public void setCredentialId(String credentialId) { this.credentialId = credentialId; }

    public byte[] getPublicKeyCose() { return publicKeyCose; }
    public void setPublicKeyCose(byte[] publicKeyCose) { this.publicKeyCose = publicKeyCose; }

    public UUID getAaguid() { return aaguid; }
    public void setAaguid(UUID aaguid) { this.aaguid = aaguid; }

    public long getSignCount() { return signCount; }
    public void setSignCount(long signCount) { this.signCount = signCount; }

    public boolean isBackupEligible() { return backupEligible; }
    public void setBackupEligible(boolean backupEligible) { this.backupEligible = backupEligible; }

    public boolean isBackupState() { return backupState; }
    public void setBackupState(boolean backupState) { this.backupState = backupState; }

    public String getDisplayName() { return displayName; }
    public void setDisplayName(String displayName) { this.displayName = displayName; }

    public CredentialStatus getCredentialStatus() { return credentialStatus; }
    public void setCredentialStatus(CredentialStatus credentialStatus) { this.credentialStatus = credentialStatus; }

    public Instant getLastUsedAt() { return lastUsedAt; }
    public void setLastUsedAt(Instant lastUsedAt) { this.lastUsedAt = lastUsedAt; }
}
