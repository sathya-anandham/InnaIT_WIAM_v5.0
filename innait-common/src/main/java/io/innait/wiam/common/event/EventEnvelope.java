package io.innait.wiam.common.event;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.time.Instant;
import java.util.UUID;

public record EventEnvelope<T>(
        @JsonProperty("event_id") UUID eventId,
        @JsonProperty("schema_version") String schemaVersion,
        @JsonProperty("event_type") String eventType,
        @JsonProperty("tenant_id") UUID tenantId,
        @JsonProperty("correlation_id") UUID correlationId,
        @JsonProperty("timestamp") Instant timestamp,
        @JsonProperty("actor_id") UUID actorId,
        @JsonProperty("actor_type") String actorType,
        @JsonProperty("payload") T payload
) {

    public static <T> Builder<T> builder() {
        return new Builder<>();
    }

    public static final class Builder<T> {
        private UUID eventId;
        private String schemaVersion = "v1";
        private String eventType;
        private UUID tenantId;
        private UUID correlationId;
        private Instant timestamp;
        private UUID actorId;
        private String actorType;
        private T payload;

        private Builder() {
        }

        public Builder<T> eventId(UUID eventId) {
            this.eventId = eventId;
            return this;
        }

        public Builder<T> schemaVersion(String schemaVersion) {
            this.schemaVersion = schemaVersion;
            return this;
        }

        public Builder<T> eventType(String eventType) {
            this.eventType = eventType;
            return this;
        }

        public Builder<T> tenantId(UUID tenantId) {
            this.tenantId = tenantId;
            return this;
        }

        public Builder<T> correlationId(UUID correlationId) {
            this.correlationId = correlationId;
            return this;
        }

        public Builder<T> timestamp(Instant timestamp) {
            this.timestamp = timestamp;
            return this;
        }

        public Builder<T> actorId(UUID actorId) {
            this.actorId = actorId;
            return this;
        }

        public Builder<T> actorType(String actorType) {
            this.actorType = actorType;
            return this;
        }

        public Builder<T> payload(T payload) {
            this.payload = payload;
            return this;
        }

        public EventEnvelope<T> build() {
            if (this.eventId == null) {
                this.eventId = UUID.randomUUID();
            }
            if (this.timestamp == null) {
                this.timestamp = Instant.now();
            }
            return new EventEnvelope<>(
                    eventId, schemaVersion, eventType, tenantId,
                    correlationId, timestamp, actorId, actorType, payload
            );
        }
    }
}
