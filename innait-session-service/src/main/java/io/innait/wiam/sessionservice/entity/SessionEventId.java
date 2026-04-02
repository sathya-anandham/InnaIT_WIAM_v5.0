package io.innait.wiam.sessionservice.entity;

import java.io.Serializable;
import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

/**
 * Composite PK for SESSION_EVENTS (interval-partitioned by EVENT_TIME).
 */
public class SessionEventId implements Serializable {

    private UUID sessionEventId;
    private Instant eventTime;

    public SessionEventId() {}

    public SessionEventId(UUID sessionEventId, Instant eventTime) {
        this.sessionEventId = sessionEventId;
        this.eventTime = eventTime;
    }

    public UUID getSessionEventId() { return sessionEventId; }
    public void setSessionEventId(UUID sessionEventId) { this.sessionEventId = sessionEventId; }

    public Instant getEventTime() { return eventTime; }
    public void setEventTime(Instant eventTime) { this.eventTime = eventTime; }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        SessionEventId that = (SessionEventId) o;
        return Objects.equals(sessionEventId, that.sessionEventId) && Objects.equals(eventTime, that.eventTime);
    }

    @Override
    public int hashCode() {
        return Objects.hash(sessionEventId, eventTime);
    }
}
