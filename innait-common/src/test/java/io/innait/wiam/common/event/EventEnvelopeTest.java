package io.innait.wiam.common.event;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import io.innait.wiam.common.event.payload.UserCreatedPayload;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class EventEnvelopeTest {

    private final ObjectMapper objectMapper = new ObjectMapper().registerModule(new JavaTimeModule());

    @Test
    void shouldSerializeAndDeserializeRoundTrip() throws Exception {
        UUID tenantId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();
        UUID correlationId = UUID.randomUUID();
        Instant now = Instant.now();

        UserCreatedPayload payload = new UserCreatedPayload(
                userId, tenantId, "EMPLOYEE", "Engineering", "Developer",
                UUID.randomUUID(), UUID.randomUUID(), "user@innait.io",
                UUID.randomUUID(), "ADMIN_CONSOLE"
        );

        EventEnvelope<UserCreatedPayload> original = EventEnvelope.<UserCreatedPayload>builder()
                .eventType("innait.identity.user.created")
                .tenantId(tenantId)
                .correlationId(correlationId)
                .timestamp(now)
                .actorId(UUID.randomUUID())
                .actorType("ADMIN")
                .payload(payload)
                .build();

        // Serialize to JSON
        String json = objectMapper.writeValueAsString(original);

        // Deserialize back
        EventEnvelope<UserCreatedPayload> deserialized = objectMapper.readValue(
                json, new TypeReference<EventEnvelope<UserCreatedPayload>>() {}
        );

        assertThat(deserialized.eventId()).isEqualTo(original.eventId());
        assertThat(deserialized.schemaVersion()).isEqualTo("v1");
        assertThat(deserialized.eventType()).isEqualTo("innait.identity.user.created");
        assertThat(deserialized.tenantId()).isEqualTo(tenantId);
        assertThat(deserialized.correlationId()).isEqualTo(correlationId);
        assertThat(deserialized.actorType()).isEqualTo("ADMIN");
    }

    @Test
    void shouldSerializePayloadFieldsWithSnakeCase() throws Exception {
        UserCreatedPayload payload = new UserCreatedPayload(
                UUID.randomUUID(), UUID.randomUUID(), "CONTRACTOR", null, null,
                null, null, "user@test.io", UUID.randomUUID(), "IGA_SYNC"
        );

        EventEnvelope<UserCreatedPayload> envelope = EventEnvelope.<UserCreatedPayload>builder()
                .eventType("innait.identity.user.created")
                .tenantId(UUID.randomUUID())
                .payload(payload)
                .build();

        String json = objectMapper.writeValueAsString(envelope);

        assertThat(json).contains("\"event_id\"");
        assertThat(json).contains("\"schema_version\"");
        assertThat(json).contains("\"event_type\"");
        assertThat(json).contains("\"tenant_id\"");
        assertThat(json).contains("\"user_id\"");
        assertThat(json).contains("\"user_type\"");
        assertThat(json).contains("\"creation_method\"");
    }

    @Test
    void builderShouldAutoGenerateEventIdAndTimestamp() {
        EventEnvelope<String> envelope = EventEnvelope.<String>builder()
                .eventType("test.event")
                .payload("data")
                .build();

        assertThat(envelope.eventId()).isNotNull();
        assertThat(envelope.timestamp()).isNotNull();
        assertThat(envelope.schemaVersion()).isEqualTo("v1");
    }

    @Test
    void shouldDeserializeWithUnknownFieldsInPayload() throws Exception {
        // Simulate a future version with extra fields
        String json = """
                {
                    "event_id": "%s",
                    "schema_version": "v1",
                    "event_type": "innait.identity.user.created",
                    "tenant_id": "%s",
                    "timestamp": "2025-01-01T00:00:00Z",
                    "payload": {
                        "user_id": "%s",
                        "tenant_id": "%s",
                        "user_type": "EMPLOYEE",
                        "email": "test@innait.io",
                        "created_by": "%s",
                        "creation_method": "API",
                        "future_field": "should_be_ignored",
                        "another_new_field": 42
                    }
                }
                """.formatted(UUID.randomUUID(), UUID.randomUUID(), UUID.randomUUID(),
                UUID.randomUUID(), UUID.randomUUID());

        EventEnvelope<UserCreatedPayload> deserialized = objectMapper.readValue(
                json, new TypeReference<EventEnvelope<UserCreatedPayload>>() {}
        );

        assertThat(deserialized.payload().userType()).isEqualTo("EMPLOYEE");
        assertThat(deserialized.payload().email()).isEqualTo("test@innait.io");
    }
}
