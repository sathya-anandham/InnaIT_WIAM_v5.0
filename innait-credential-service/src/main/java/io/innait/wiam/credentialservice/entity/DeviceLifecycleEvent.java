package io.innait.wiam.credentialservice.entity;

import io.innait.wiam.common.entity.BaseEntity;
import jakarta.persistence.*;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "DEVICE_LIFECYCLE_EVENTS")
@AttributeOverride(name = "id", column = @Column(name = "DEVICE_EVENT_ID", columnDefinition = "RAW(16)"))
public class DeviceLifecycleEvent extends BaseEntity {

    @Column(name = "DEVICE_ID", columnDefinition = "RAW(16)", nullable = false)
    private UUID deviceId;

    @Column(name = "EVENT_TYPE", nullable = false, length = 50)
    private String eventType;

    @Column(name = "OLD_STATUS", length = 30)
    private String oldStatus;

    @Column(name = "NEW_STATUS", length = 30)
    private String newStatus;

    @Column(name = "EVENT_TIME", nullable = false)
    private Instant eventTime;

    @Column(name = "ACTOR_ID", columnDefinition = "RAW(16)")
    private UUID actorId;

    @Lob
    @Column(name = "DETAIL")
    private String detail;

    // Getters and setters

    public UUID getDeviceId() { return deviceId; }
    public void setDeviceId(UUID deviceId) { this.deviceId = deviceId; }

    public String getEventType() { return eventType; }
    public void setEventType(String eventType) { this.eventType = eventType; }

    public String getOldStatus() { return oldStatus; }
    public void setOldStatus(String oldStatus) { this.oldStatus = oldStatus; }

    public String getNewStatus() { return newStatus; }
    public void setNewStatus(String newStatus) { this.newStatus = newStatus; }

    public Instant getEventTime() { return eventTime; }
    public void setEventTime(Instant eventTime) { this.eventTime = eventTime; }

    public UUID getActorId() { return actorId; }
    public void setActorId(UUID actorId) { this.actorId = actorId; }

    public String getDetail() { return detail; }
    public void setDetail(String detail) { this.detail = detail; }
}
