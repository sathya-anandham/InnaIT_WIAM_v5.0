package io.innait.wiam.auditservice.service;

import io.innait.wiam.auditservice.entity.AuditEvent;
import io.innait.wiam.auditservice.entity.AuditOutcome;
import io.innait.wiam.auditservice.entity.EventCategory;
import io.innait.wiam.common.event.EventEnvelope;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Component;

import java.util.Map;
import java.util.UUID;

/**
 * Maps EventEnvelope from Kafka topics into AuditEvent entities.
 */
@Component
public class AuditEventMapper {

    private final ObjectMapper objectMapper;

    public AuditEventMapper(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    public AuditEvent mapToAuditEvent(EventEnvelope<?> envelope, String topic) {
        return new AuditEvent(
                UUID.randomUUID(),
                envelope.tenantId(),
                envelope.correlationId(),
                envelope.eventType(),
                deriveCategory(topic),
                envelope.actorId(),
                envelope.actorType(),
                extractStringFromPayload(envelope.payload(), "ip_address"),
                extractUuidFromPayload(envelope.payload(), "subject_id"),
                extractStringFromPayload(envelope.payload(), "subject_type"),
                extractStringFromPayload(envelope.payload(), "resource_type"),
                extractUuidFromPayload(envelope.payload(), "resource_id"),
                deriveAction(envelope.eventType()),
                deriveOutcome(envelope.eventType()),
                serializePayload(envelope.payload()),
                deriveServiceName(topic),
                envelope.timestamp()
        );
    }

    /**
     * Derive event category from Kafka topic name.
     * innait.authn.* → AUTHENTICATION, innait.credential.* → CREDENTIAL, etc.
     */
    public EventCategory deriveCategory(String topic) {
        if (topic == null) return EventCategory.SYSTEM;

        if (topic.startsWith("innait.authn")) return EventCategory.AUTHENTICATION;
        if (topic.startsWith("innait.credential")) return EventCategory.CREDENTIAL;
        if (topic.startsWith("innait.identity")) return EventCategory.USER_MANAGEMENT;
        if (topic.startsWith("innait.session")) return EventCategory.SESSION;
        if (topic.startsWith("innait.policy")) return EventCategory.POLICY;
        if (topic.startsWith("innait.admin")) return EventCategory.CONFIG;
        if (topic.startsWith("innait.connector")) return EventCategory.DIRECTORY_SYNC;
        if (topic.startsWith("innait.security")) return EventCategory.SECURITY;

        return EventCategory.SYSTEM;
    }

    /**
     * Derive action from event_type.
     * user.created → CREATE, account.role.assigned → ASSIGN, etc.
     */
    public String deriveAction(String eventType) {
        if (eventType == null) return "UNKNOWN";

        String lower = eventType.toLowerCase();
        if (lower.contains("created")) return "CREATE";
        if (lower.contains("updated") || lower.contains("changed")) return "UPDATE";
        if (lower.contains("deleted") || lower.contains("terminated") || lower.contains("revoked")) return "DELETE";
        if (lower.contains("assigned")) return "ASSIGN";
        if (lower.contains("removed")) return "REMOVE";
        if (lower.contains("enrolled")) return "ENROLL";
        if (lower.contains("started")) return "INITIATE";
        if (lower.contains("succeeded") || lower.contains("completed")) return "COMPLETE";
        if (lower.contains("failed")) return "FAIL";
        if (lower.contains("logged")) return "LOG";

        return "OTHER";
    }

    /**
     * Derive outcome from event_type.
     * auth.failed → FAILURE, most others → SUCCESS.
     */
    public AuditOutcome deriveOutcome(String eventType) {
        if (eventType == null) return AuditOutcome.SUCCESS;

        String lower = eventType.toLowerCase();
        if (lower.contains("failed") || lower.contains("denied")) return AuditOutcome.FAILURE;
        if (lower.contains("error")) return AuditOutcome.ERROR;

        return AuditOutcome.SUCCESS;
    }

    /**
     * Derive service name from topic prefix.
     */
    public String deriveServiceName(String topic) {
        if (topic == null) return "unknown";

        // innait.identity.user.created → identity
        String[] parts = topic.split("\\.");
        return parts.length >= 2 ? parts[1] : "unknown";
    }

    private String serializePayload(Object payload) {
        if (payload == null) return null;
        try {
            return objectMapper.writeValueAsString(payload);
        } catch (JsonProcessingException e) {
            return payload.toString();
        }
    }

    @SuppressWarnings("unchecked")
    private String extractStringFromPayload(Object payload, String key) {
        if (payload instanceof Map<?, ?> map) {
            Object value = map.get(key);
            return value != null ? value.toString() : null;
        }
        return null;
    }

    @SuppressWarnings("unchecked")
    private UUID extractUuidFromPayload(Object payload, String key) {
        String value = extractStringFromPayload(payload, key);
        if (value != null) {
            try {
                return UUID.fromString(value);
            } catch (IllegalArgumentException e) {
                return null;
            }
        }
        return null;
    }
}
