package io.innait.wiam.identityservice.entity;

import io.innait.wiam.common.entity.BaseEntity;
import jakarta.persistence.AttributeOverride;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;

import java.util.UUID;

@Entity
@Table(name = "ENTITLEMENTS")
@AttributeOverride(name = "id", column = @Column(name = "ENTITLEMENT_ID", columnDefinition = "RAW(16)"))
public class Entitlement extends BaseEntity {

    @Column(name = "ENTITLEMENT_CODE", nullable = false, length = 100)
    private String entitlementCode;

    @Column(name = "ENTITLEMENT_NAME", nullable = false, length = 255)
    private String entitlementName;

    @Column(name = "DESCRIPTION", length = 1000)
    private String description;

    @Enumerated(EnumType.STRING)
    @Column(name = "ENTITLEMENT_TYPE", nullable = false, length = 30)
    private EntitlementType entitlementType;

    @Column(name = "APP_ID", columnDefinition = "RAW(16)")
    private UUID appId;

    @Enumerated(EnumType.STRING)
    @Column(name = "STATUS", nullable = false, length = 20)
    private ActiveStatus status;

    // Getters and setters

    public String getEntitlementCode() { return entitlementCode; }
    public void setEntitlementCode(String entitlementCode) { this.entitlementCode = entitlementCode; }

    public String getEntitlementName() { return entitlementName; }
    public void setEntitlementName(String entitlementName) { this.entitlementName = entitlementName; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public EntitlementType getEntitlementType() { return entitlementType; }
    public void setEntitlementType(EntitlementType entitlementType) { this.entitlementType = entitlementType; }

    public UUID getAppId() { return appId; }
    public void setAppId(UUID appId) { this.appId = appId; }

    public ActiveStatus getStatus() { return status; }
    public void setStatus(ActiveStatus status) { this.status = status; }
}
