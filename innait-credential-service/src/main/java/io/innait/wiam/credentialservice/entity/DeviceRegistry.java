package io.innait.wiam.credentialservice.entity;

import io.innait.wiam.common.entity.AuditableEntity;
import jakarta.persistence.*;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "DEVICE_REGISTRY")
@AttributeOverride(name = "id", column = @Column(name = "DEVICE_ID", columnDefinition = "RAW(16)"))
public class DeviceRegistry extends AuditableEntity {

    @Enumerated(EnumType.STRING)
    @Column(name = "DEVICE_TYPE", nullable = false, length = 30)
    private DeviceType deviceType = DeviceType.FIDO_KEY;

    @Column(name = "DEVICE_CATEGORY", length = 30)
    private String deviceCategory;

    @Column(name = "DEVICE_MODEL", length = 100)
    private String deviceModel;

    @Column(name = "DEVICE_VENDOR", length = 100)
    private String deviceVendor;

    @Column(name = "DEVICE_SERIAL_NO", length = 150)
    private String deviceSerialNo;

    @Column(name = "DEVICE_UNIQUE_REF", nullable = false, length = 255)
    private String deviceUniqueRef;

    @Enumerated(EnumType.STRING)
    @Column(name = "DEVICE_STATUS", nullable = false, length = 30)
    private DeviceStatus deviceStatus = DeviceStatus.IN_STOCK;

    @Enumerated(EnumType.STRING)
    @Column(name = "OWNERSHIP_MODE", nullable = false, length = 20)
    private OwnershipMode ownershipMode = OwnershipMode.DEDICATED;

    @Column(name = "PROCUREMENT_BATCH_ID", columnDefinition = "RAW(16)")
    private UUID procurementBatchId;

    @Column(name = "PURCHASE_DATE")
    private Instant purchaseDate;

    @Column(name = "WARRANTY_EXPIRY")
    private Instant warrantyExpiry;

    @Column(name = "IS_ACTIVE", nullable = false)
    private boolean active = true;

    // Getters and setters

    public DeviceType getDeviceType() { return deviceType; }
    public void setDeviceType(DeviceType deviceType) { this.deviceType = deviceType; }

    public String getDeviceCategory() { return deviceCategory; }
    public void setDeviceCategory(String deviceCategory) { this.deviceCategory = deviceCategory; }

    public String getDeviceModel() { return deviceModel; }
    public void setDeviceModel(String deviceModel) { this.deviceModel = deviceModel; }

    public String getDeviceVendor() { return deviceVendor; }
    public void setDeviceVendor(String deviceVendor) { this.deviceVendor = deviceVendor; }

    public String getDeviceSerialNo() { return deviceSerialNo; }
    public void setDeviceSerialNo(String deviceSerialNo) { this.deviceSerialNo = deviceSerialNo; }

    public String getDeviceUniqueRef() { return deviceUniqueRef; }
    public void setDeviceUniqueRef(String deviceUniqueRef) { this.deviceUniqueRef = deviceUniqueRef; }

    public DeviceStatus getDeviceStatus() { return deviceStatus; }
    public void setDeviceStatus(DeviceStatus deviceStatus) { this.deviceStatus = deviceStatus; }

    public OwnershipMode getOwnershipMode() { return ownershipMode; }
    public void setOwnershipMode(OwnershipMode ownershipMode) { this.ownershipMode = ownershipMode; }

    public UUID getProcurementBatchId() { return procurementBatchId; }
    public void setProcurementBatchId(UUID procurementBatchId) { this.procurementBatchId = procurementBatchId; }

    public Instant getPurchaseDate() { return purchaseDate; }
    public void setPurchaseDate(Instant purchaseDate) { this.purchaseDate = purchaseDate; }

    public Instant getWarrantyExpiry() { return warrantyExpiry; }
    public void setWarrantyExpiry(Instant warrantyExpiry) { this.warrantyExpiry = warrantyExpiry; }

    public boolean isActive() { return active; }
    public void setActive(boolean active) { this.active = active; }
}
