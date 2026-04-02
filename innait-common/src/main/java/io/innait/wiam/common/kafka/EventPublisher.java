package io.innait.wiam.common.kafka;

import io.innait.wiam.common.context.CorrelationContext;
import io.innait.wiam.common.event.EventEnvelope;
import org.apache.kafka.clients.producer.ProducerRecord;
import org.apache.kafka.common.header.Headers;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.kafka.support.SendResult;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;

@Service
public class EventPublisher {

    private static final Logger log = LoggerFactory.getLogger(EventPublisher.class);

    private final KafkaTemplate<String, Object> kafkaTemplate;

    public EventPublisher(KafkaTemplate<String, Object> kafkaTemplate) {
        this.kafkaTemplate = kafkaTemplate;
    }

    public CompletableFuture<SendResult<String, Object>> publish(String topic, EventEnvelope<?> event) {
        // Use tenantId as partition key to ensure tenant event ordering
        String key = event.tenantId() != null ? event.tenantId().toString() : null;

        ProducerRecord<String, Object> record = new ProducerRecord<>(topic, null, key, event);
        addHeaders(record.headers(), event);

        log.debug("Publishing event [{}] to topic [{}] with key [{}]", event.eventType(), topic, key);

        return kafkaTemplate.send(record)
                .whenComplete((result, ex) -> {
                    if (ex != null) {
                        log.error("Failed to publish event [{}] to topic [{}]: {}",
                                event.eventType(), topic, ex.getMessage());
                    } else {
                        log.debug("Event [{}] published to topic [{}] partition [{}] offset [{}]",
                                event.eventType(), topic,
                                result.getRecordMetadata().partition(),
                                result.getRecordMetadata().offset());
                    }
                });
    }

    private void addHeaders(Headers headers, EventEnvelope<?> event) {
        if (event.tenantId() != null) {
            headers.add("tenant_id", event.tenantId().toString().getBytes(StandardCharsets.UTF_8));
        }

        UUID correlationId = event.correlationId();
        if (correlationId == null) {
            correlationId = CorrelationContext.getCorrelationId();
        }
        if (correlationId != null) {
            headers.add("correlation_id", correlationId.toString().getBytes(StandardCharsets.UTF_8));
        }

        if (event.eventType() != null) {
            headers.add("event_type", event.eventType().getBytes(StandardCharsets.UTF_8));
        }
    }
}
