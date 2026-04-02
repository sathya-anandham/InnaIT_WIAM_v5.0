package io.innait.wiam.credentialservice.entity;

import io.innait.wiam.common.entity.BaseEntity;
import jakarta.persistence.*;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "SOFTTOKEN_CREDENTIALS")
@AttributeOverride(name = "id", column = @Column(name = "SOFTTOKEN_CRED_ID", columnDefinition = "RAW(16)"))
public class SoftTokenCredential extends BaseEntity {

    @Column(name = "ACCOUNT_ID", columnDefinition = "RAW(16)", nullable = false)
    private UUID accountId;

    @Column(name = "DEVICE_ID", nullable = false, length = 255)
    private String deviceId;

    @Column(name = "DEVICE_NAME", length = 255)
    private String deviceName;

    @Enumerated(EnumType.STRING)
    @Column(name = "DEVICE_PLATFORM", nullable = false, length = 20)
    private DevicePlatform devicePlatform;

    @Lob
    @Column(name = "PUBLIC_KEY", nullable = false)
    private byte[] publicKey;

    @Column(name = "PUSH_TOKEN", length = 512)
    private String pushToken;

    @Enumerated(EnumType.STRING)
    @Column(name = "ACTIVATION_STATUS", nullable = false, length = 20)
    private ActivationStatus activationStatus = ActivationStatus.PENDING;

    @Column(name = "LAST_USED_AT")
    private Instant lastUsedAt;

    // Getters and setters

    public UUID getAccountId() { return accountId; }
    public void setAccountId(UUID accountId) { this.accountId = accountId; }

    public String getDeviceId() { return deviceId; }
    public void setDeviceId(String deviceId) { this.deviceId = deviceId; }

    public String getDeviceName() { return deviceName; }
    public void setDeviceName(String deviceName) { this.deviceName = deviceName; }

    public DevicePlatform getDevicePlatform() { return devicePlatform; }
    public void setDevicePlatform(DevicePlatform devicePlatform) { this.devicePlatform = devicePlatform; }

    public byte[] getPublicKey() { return publicKey; }
    public void setPublicKey(byte[] publicKey) { this.publicKey = publicKey; }

    public String getPushToken() { return pushToken; }
    public void setPushToken(String pushToken) { this.pushToken = pushToken; }

    public ActivationStatus getActivationStatus() { return activationStatus; }
    public void setActivationStatus(ActivationStatus activationStatus) { this.activationStatus = activationStatus; }

    public Instant getLastUsedAt() { return lastUsedAt; }
    public void setLastUsedAt(Instant lastUsedAt) { this.lastUsedAt = lastUsedAt; }
}
