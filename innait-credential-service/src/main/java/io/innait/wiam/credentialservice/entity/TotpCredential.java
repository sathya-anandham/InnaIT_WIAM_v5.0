package io.innait.wiam.credentialservice.entity;

import io.innait.wiam.common.constant.CredentialStatus;
import io.innait.wiam.common.entity.BaseEntity;
import jakarta.persistence.*;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "TOTP_CREDENTIALS")
@AttributeOverride(name = "id", column = @Column(name = "TOTP_CRED_ID", columnDefinition = "RAW(16)"))
public class TotpCredential extends BaseEntity {

    @Column(name = "ACCOUNT_ID", columnDefinition = "RAW(16)", nullable = false)
    private UUID accountId;

    @Column(name = "ENCRYPTED_SECRET", columnDefinition = "RAW(256)", nullable = false)
    private byte[] encryptedSecret;

    @Column(name = "SECRET_IV", columnDefinition = "RAW(16)", nullable = false)
    private byte[] secretIv;

    @Column(name = "SECRET_KEK_VERSION", nullable = false)
    private int secretKekVersion = 1;

    @Enumerated(EnumType.STRING)
    @Column(name = "ALGORITHM", nullable = false, length = 10)
    private TotpAlgorithm algorithm = TotpAlgorithm.SHA1;

    @Column(name = "DIGITS", nullable = false)
    private int digits = 6;

    @Column(name = "PERIOD_SECONDS", nullable = false)
    private int periodSeconds = 30;

    @Enumerated(EnumType.STRING)
    @Column(name = "CREDENTIAL_STATUS", nullable = false, length = 20)
    private CredentialStatus credentialStatus = CredentialStatus.ACTIVE;

    @Column(name = "VERIFIED", nullable = false)
    private boolean verified = false;

    @Column(name = "LAST_USED_AT")
    private Instant lastUsedAt;

    // Getters and setters

    public UUID getAccountId() { return accountId; }
    public void setAccountId(UUID accountId) { this.accountId = accountId; }

    public byte[] getEncryptedSecret() { return encryptedSecret; }
    public void setEncryptedSecret(byte[] encryptedSecret) { this.encryptedSecret = encryptedSecret; }

    public byte[] getSecretIv() { return secretIv; }
    public void setSecretIv(byte[] secretIv) { this.secretIv = secretIv; }

    public int getSecretKekVersion() { return secretKekVersion; }
    public void setSecretKekVersion(int secretKekVersion) { this.secretKekVersion = secretKekVersion; }

    public TotpAlgorithm getAlgorithm() { return algorithm; }
    public void setAlgorithm(TotpAlgorithm algorithm) { this.algorithm = algorithm; }

    public int getDigits() { return digits; }
    public void setDigits(int digits) { this.digits = digits; }

    public int getPeriodSeconds() { return periodSeconds; }
    public void setPeriodSeconds(int periodSeconds) { this.periodSeconds = periodSeconds; }

    public CredentialStatus getCredentialStatus() { return credentialStatus; }
    public void setCredentialStatus(CredentialStatus credentialStatus) { this.credentialStatus = credentialStatus; }

    public boolean isVerified() { return verified; }
    public void setVerified(boolean verified) { this.verified = verified; }

    public Instant getLastUsedAt() { return lastUsedAt; }
    public void setLastUsedAt(Instant lastUsedAt) { this.lastUsedAt = lastUsedAt; }
}
