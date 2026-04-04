package io.innait.wiam.credentialservice.entity;

import io.innait.wiam.common.entity.BaseEntity;
import jakarta.persistence.*;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "DEVICE_DELIVERY_LOG")
@AttributeOverride(name = "id", column = @Column(name = "DELIVERY_LOG_ID", columnDefinition = "RAW(16)"))
public class DeviceDeliveryLog extends BaseEntity {

    @Column(name = "DEVICE_ID", columnDefinition = "RAW(16)", nullable = false)
    private UUID deviceId;

    @Column(name = "DEVICE_ASSIGNMENT_ID", columnDefinition = "RAW(16)", nullable = false)
    private UUID deviceAssignmentId;

    @Enumerated(EnumType.STRING)
    @Column(name = "EVENT_TYPE", nullable = false, length = 30)
    private DeliveryEventType eventType;

    @Column(name = "EVENT_TIME", nullable = false)
    private Instant eventTime;

    @Column(name = "HANDLED_BY", columnDefinition = "RAW(16)")
    private UUID handledBy;

    @Column(name = "COMMENTS", length = 1000)
    private String comments;

    // Getters and setters

    public UUID getDeviceId() { return deviceId; }
    public void setDeviceId(UUID deviceId) { this.deviceId = deviceId; }

    public UUID getDeviceAssignmentId() { return deviceAssignmentId; }
    public void setDeviceAssignmentId(UUID deviceAssignmentId) { this.deviceAssignmentId = deviceAssignmentId; }

    public DeliveryEventType getEventType() { return eventType; }
    public void setEventType(DeliveryEventType eventType) { this.eventType = eventType; }

    public Instant getEventTime() { return eventTime; }
    public void setEventTime(Instant eventTime) { this.eventTime = eventTime; }

    public UUID getHandledBy() { return handledBy; }
    public void setHandledBy(UUID handledBy) { this.handledBy = handledBy; }

    public String getComments() { return comments; }
    public void setComments(String comments) { this.comments = comments; }
}
