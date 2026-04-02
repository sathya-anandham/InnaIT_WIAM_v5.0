package io.innait.wiam.common.kafka;

import io.innait.wiam.common.context.CorrelationContext;
import io.innait.wiam.common.context.TenantContext;
import io.innait.wiam.common.event.EventEnvelope;
import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.apache.kafka.common.header.Header;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.listener.AcknowledgingMessageListener;
import org.springframework.kafka.support.Acknowledgment;

import java.nio.charset.StandardCharsets;
import java.util.UUID;

/**
 * Base class for Kafka event consumers with tenant validation and correlation tracking.
 *
 * @param <T> the payload type contained in the EventEnvelope
 */
public abstract class AbstractEventConsumer<T> implements AcknowledgingMessageListener<String, EventEnvelope<T>> {

    private final Logger log = LoggerFactory.getLogger(getClass());

    @Override
    public void onMessage(ConsumerRecord<String, EventEnvelope<T>> record, Acknowledgment acknowledgment) {
        EventEnvelope<T> envelope = record.value();
        try {
            // Set correlation context from header
            UUID correlationId = extractUuidHeader(record, "correlation_id");
            if (correlationId != null) {
                CorrelationContext.setCorrelationId(correlationId);
            } else if (envelope.correlationId() != null) {
                CorrelationContext.setCorrelationId(envelope.correlationId());
            }

            // Validate and set tenant context
            UUID tenantId = extractUuidHeader(record, "tenant_id");
            if (tenantId == null) {
                tenantId = envelope.tenantId();
            }
            if (tenantId == null) {
                log.warn("Skipping event [{}] - no tenant_id in header or envelope", envelope.eventType());
                if (acknowledgment != null) {
                    acknowledgment.acknowledge();
                }
                return;
            }
            TenantContext.setTenantId(tenantId);

            log.debug("Processing event [{}] for tenant [{}] correlation [{}]",
                    envelope.eventType(), tenantId, CorrelationContext.getCorrelationId());

            process(envelope);

            if (acknowledgment != null) {
                acknowledgment.acknowledge();
            }
        } catch (Exception e) {
            log.error("Error processing event [{}] from topic [{}] partition [{}] offset [{}]: {}",
                    envelope != null ? envelope.eventType() : "unknown",
                    record.topic(), record.partition(), record.offset(), e.getMessage(), e);
            throw e; // Let error handler / DLT take over
        } finally {
            TenantContext.clear();
            CorrelationContext.clear();
        }
    }

    /**
     * Process the event envelope. Implementations must be idempotent.
     */
    protected abstract void process(EventEnvelope<T> envelope);

    private UUID extractUuidHeader(ConsumerRecord<?, ?> record, String headerName) {
        Header header = record.headers().lastHeader(headerName);
        if (header != null && header.value() != null) {
            try {
                return UUID.fromString(new String(header.value(), StandardCharsets.UTF_8));
            } catch (IllegalArgumentException e) {
                log.warn("Invalid UUID in header [{}]: {}", headerName, e.getMessage());
            }
        }
        return null;
    }
}
