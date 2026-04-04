package io.innait.wiam.credentialservice.entity;

import io.innait.wiam.common.entity.BaseEntity;
import jakarta.persistence.*;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "DEVICE_ASSIGNMENTS")
@AttributeOverride(name = "id", column = @Column(name = "DEVICE_ASSIGNMENT_ID", columnDefinition = "RAW(16)"))
public class DeviceAssignment extends BaseEntity {

    @Column(name = "DEVICE_ID", columnDefinition = "RAW(16)", nullable = false)
    private UUID deviceId;

    @Column(name = "USER_ID", columnDefinition = "RAW(16)")
    private UUID userId;

    @Column(name = "ACCOUNT_ID", columnDefinition = "RAW(16)", nullable = false)
    private UUID accountId;

    @Enumerated(EnumType.STRING)
    @Column(name = "ASSIGNMENT_TYPE", nullable = false, length = 20)
    private AssignmentType assignmentType = AssignmentType.PRIMARY;

    @Enumerated(EnumType.STRING)
    @Column(name = "ASSIGNMENT_STATUS", nullable = false, length = 20)
    private AssignmentStatus assignmentStatus = AssignmentStatus.PENDING;

    @Column(name = "ASSIGNED_AT")
    private Instant assignedAt;

    @Column(name = "EFFECTIVE_FROM")
    private Instant effectiveFrom;

    @Column(name = "EFFECTIVE_TO")
    private Instant effectiveTo;

    @Enumerated(EnumType.STRING)
    @Column(name = "DELIVERY_STATUS", length = 20)
    private DeliveryStatus deliveryStatus;

    @Column(name = "ASSIGNED_BY", columnDefinition = "RAW(16)")
    private UUID assignedBy;

    @Column(name = "APPROVED_BY", columnDefinition = "RAW(16)")
    private UUID approvedBy;

    @Column(name = "REVOKED_BY", columnDefinition = "RAW(16)")
    private UUID revokedBy;

    @Column(name = "REVOKED_AT")
    private Instant revokedAt;

    @Column(name = "REVOCATION_REASON", length = 255)
    private String revocationReason;

    @Column(name = "IS_ACTIVE", nullable = false)
    private boolean active = true;

    // Getters and setters

    public UUID getDeviceId() { return deviceId; }
    public void setDeviceId(UUID deviceId) { this.deviceId = deviceId; }

    public UUID getUserId() { return userId; }
    public void setUserId(UUID userId) { this.userId = userId; }

    public UUID getAccountId() { return accountId; }
    public void setAccountId(UUID accountId) { this.accountId = accountId; }

    public AssignmentType getAssignmentType() { return assignmentType; }
    public void setAssignmentType(AssignmentType assignmentType) { this.assignmentType = assignmentType; }

    public AssignmentStatus getAssignmentStatus() { return assignmentStatus; }
    public void setAssignmentStatus(AssignmentStatus assignmentStatus) { this.assignmentStatus = assignmentStatus; }

    public Instant getAssignedAt() { return assignedAt; }
    public void setAssignedAt(Instant assignedAt) { this.assignedAt = assignedAt; }

    public Instant getEffectiveFrom() { return effectiveFrom; }
    public void setEffectiveFrom(Instant effectiveFrom) { this.effectiveFrom = effectiveFrom; }

    public Instant getEffectiveTo() { return effectiveTo; }
    public void setEffectiveTo(Instant effectiveTo) { this.effectiveTo = effectiveTo; }

    public DeliveryStatus getDeliveryStatus() { return deliveryStatus; }
    public void setDeliveryStatus(DeliveryStatus deliveryStatus) { this.deliveryStatus = deliveryStatus; }

    public UUID getAssignedBy() { return assignedBy; }
    public void setAssignedBy(UUID assignedBy) { this.assignedBy = assignedBy; }

    public UUID getApprovedBy() { return approvedBy; }
    public void setApprovedBy(UUID approvedBy) { this.approvedBy = approvedBy; }

    public UUID getRevokedBy() { return revokedBy; }
    public void setRevokedBy(UUID revokedBy) { this.revokedBy = revokedBy; }

    public Instant getRevokedAt() { return revokedAt; }
    public void setRevokedAt(Instant revokedAt) { this.revokedAt = revokedAt; }

    public String getRevocationReason() { return revocationReason; }
    public void setRevocationReason(String revocationReason) { this.revocationReason = revocationReason; }

    public boolean isActive() { return active; }
    public void setActive(boolean active) { this.active = active; }
}
