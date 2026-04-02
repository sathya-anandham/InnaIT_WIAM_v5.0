package io.innait.wiam.sessionservice.entity;

import jakarta.persistence.*;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "SESSION_EVENTS")
@IdClass(SessionEventId.class)
public class SessionEvent {

    @Id
    @Column(name = "SESSION_EVENT_ID", columnDefinition = "RAW(16)", updatable = false, nullable = false)
    private UUID sessionEventId;

    @Id
    @Column(name = "EVENT_TIME", nullable = false, updatable = false)
    private Instant eventTime;

    @Column(name = "SESSION_ID", columnDefinition = "RAW(16)", nullable = false)
    private UUID sessionId;

    @Column(name = "TENANT_ID", columnDefinition = "RAW(16)", nullable = false)
    private UUID tenantId;

    @Column(name = "EVENT_TYPE", length = 50, nullable = false)
    private String eventType;

    @Column(name = "EVENT_DATA", columnDefinition = "CLOB")
    private String eventData;

    @PrePersist
    protected void onCreate() {
        if (sessionEventId == null) sessionEventId = UUID.randomUUID();
        if (eventTime == null) eventTime = Instant.now();
    }

    // Getters and setters

    public UUID getSessionEventId() { return sessionEventId; }
    public void setSessionEventId(UUID sessionEventId) { this.sessionEventId = sessionEventId; }

    public Instant getEventTime() { return eventTime; }
    public void setEventTime(Instant eventTime) { this.eventTime = eventTime; }

    public UUID getSessionId() { return sessionId; }
    public void setSessionId(UUID sessionId) { this.sessionId = sessionId; }

    public UUID getTenantId() { return tenantId; }
    public void setTenantId(UUID tenantId) { this.tenantId = tenantId; }

    public String getEventType() { return eventType; }
    public void setEventType(String eventType) { this.eventType = eventType; }

    public String getEventData() { return eventData; }
    public void setEventData(String eventData) { this.eventData = eventData; }
}
