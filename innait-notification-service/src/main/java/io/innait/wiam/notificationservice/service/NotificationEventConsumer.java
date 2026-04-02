package io.innait.wiam.notificationservice.service;

import io.innait.wiam.common.context.TenantContext;
import io.innait.wiam.common.event.EventEnvelope;
import io.innait.wiam.common.kafka.InnaITTopics;
import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

/**
 * Kafka consumer that triggers notifications based on platform events.
 * Consumer group: innait-core-notification
 */
@Service
public class NotificationEventConsumer {

    private static final Logger log = LoggerFactory.getLogger(NotificationEventConsumer.class);

    private final NotificationService notificationService;

    public NotificationEventConsumer(NotificationService notificationService) {
        this.notificationService = notificationService;
    }

    @KafkaListener(
            topics = {
                    InnaITTopics.USER_CREATED,
                    InnaITTopics.CREDENTIAL_ENROLLED,
                    InnaITTopics.CREDENTIAL_REVOKED
            },
            groupId = "innait-core-notification",
            properties = {
                    "auto.offset.reset=earliest",
                    "enable.auto.commit=false"
            }
    )
    public void onEvent(ConsumerRecord<String, EventEnvelope<?>> record) {
        EventEnvelope<?> envelope = record.value();
        if (envelope == null || envelope.tenantId() == null) {
            log.warn("Skipping notification event with null envelope or tenant");
            return;
        }

        try {
            TenantContext.setTenantId(envelope.tenantId());
            String eventType = envelope.eventType();

            switch (eventType) {
                case "user.created" -> handleUserCreated(envelope);
                case "credential.enrolled" -> handleCredentialEnrolled(envelope);
                case "credential.revoked" -> handleCredentialRevoked(envelope);
                default -> log.debug("No notification handler for event type: {}", eventType);
            }
        } catch (Exception e) {
            log.error("Error processing notification event [{}]: {}",
                    envelope.eventType(), e.getMessage(), e);
        } finally {
            TenantContext.clear();
        }
    }

    @SuppressWarnings("unchecked")
    private void handleUserCreated(EventEnvelope<?> envelope) {
        Map<String, Object> payload = asMap(envelope.payload());
        String email = getString(payload, "email");
        String displayName = getString(payload, "display_name");

        if (email == null) {
            log.warn("No email in user.created event, skipping welcome email");
            return;
        }

        Map<String, String> vars = new HashMap<>();
        vars.put("displayName", displayName != null ? displayName : "User");
        vars.put("loginUrl", getString(payload, "login_url", "https://auth.innait.io/login"));
        vars.put("tenantName", getString(payload, "tenant_name", "InnaIT"));

        try {
            notificationService.sendEmail(envelope.tenantId(), email, "welcome_email", vars);
        } catch (Exception e) {
            log.error("Failed to send welcome email to [{}]: {}", email, e.getMessage());
        }
    }

    private void handleCredentialEnrolled(EventEnvelope<?> envelope) {
        Map<String, Object> payload = asMap(envelope.payload());
        String email = getString(payload, "email");
        String credentialType = getString(payload, "credential_type");

        if (email == null) return;

        Map<String, String> vars = new HashMap<>();
        vars.put("displayName", getString(payload, "display_name", "User"));
        vars.put("credentialType", credentialType != null ? credentialType : "credential");

        try {
            notificationService.sendEmail(envelope.tenantId(), email, "credential_enrolled", vars);
        } catch (Exception e) {
            log.error("Failed to send credential enrolled email: {}", e.getMessage());
        }
    }

    private void handleCredentialRevoked(EventEnvelope<?> envelope) {
        Map<String, Object> payload = asMap(envelope.payload());
        String email = getString(payload, "email");
        String credentialType = getString(payload, "credential_type");

        if (email == null) return;

        Map<String, String> vars = new HashMap<>();
        vars.put("displayName", getString(payload, "display_name", "User"));
        vars.put("credentialType", credentialType != null ? credentialType : "credential");

        try {
            notificationService.sendEmail(envelope.tenantId(), email, "credential_enrolled", vars);
        } catch (Exception e) {
            log.error("Failed to send credential revoked email: {}", e.getMessage());
        }
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> asMap(Object payload) {
        if (payload instanceof Map<?, ?> map) {
            return (Map<String, Object>) map;
        }
        return Map.of();
    }

    private String getString(Map<String, Object> map, String key) {
        Object val = map.get(key);
        return val != null ? val.toString() : null;
    }

    private String getString(Map<String, Object> map, String key, String defaultValue) {
        String val = getString(map, key);
        return val != null ? val : defaultValue;
    }
}
