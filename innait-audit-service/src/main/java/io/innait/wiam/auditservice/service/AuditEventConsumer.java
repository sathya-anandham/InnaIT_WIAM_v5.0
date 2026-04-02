package io.innait.wiam.auditservice.service;

import io.innait.wiam.auditservice.entity.AuditEvent;
import io.innait.wiam.auditservice.repository.AuditEventRepository;
import io.innait.wiam.common.event.EventEnvelope;
import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;
import java.util.concurrent.ConcurrentLinkedQueue;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Kafka consumer that listens to all core InnaIT topics and persists
 * audit events with batch inserts and failure buffering.
 */
@Service
public class AuditEventConsumer {

    private static final Logger log = LoggerFactory.getLogger(AuditEventConsumer.class);

    private final AuditEventRepository auditEventRepository;
    private final AuditEventMapper mapper;
    private final SecurityIncidentDetector incidentDetector;

    /** Batch buffer: accumulates events for batch INSERT */
    private final ConcurrentLinkedQueue<AuditEvent> batchBuffer = new ConcurrentLinkedQueue<>();

    /** Failure buffer: holds events when DB insert fails */
    private final ConcurrentLinkedQueue<TimestampedEvent> failureBuffer = new ConcurrentLinkedQueue<>();

    private final AtomicBoolean dbAvailable = new AtomicBoolean(true);

    @Value("${innait.audit.batch-size:500}")
    private int batchSize;

    @Value("${innait.audit.failure-buffer-max:10000}")
    private int failureBufferMax;

    @Value("${innait.audit.failure-buffer-retention-seconds:300}")
    private long failureBufferRetentionSeconds;

    public AuditEventConsumer(AuditEventRepository auditEventRepository,
                              AuditEventMapper mapper,
                              SecurityIncidentDetector incidentDetector) {
        this.auditEventRepository = auditEventRepository;
        this.mapper = mapper;
        this.incidentDetector = incidentDetector;
    }

    @KafkaListener(
            topicPattern = "innait\\.(identity|credential|authn|session|policy|admin)\\..*",
            groupId = "innait-core-audit",
            properties = {
                    "auto.offset.reset=earliest",
                    "enable.auto.commit=false"
            }
    )
    public void onEvent(ConsumerRecord<String, EventEnvelope<?>> record) {
        try {
            EventEnvelope<?> envelope = record.value();
            if (envelope == null || envelope.tenantId() == null) {
                log.warn("Skipping event with null envelope or tenant from topic: {}", record.topic());
                return;
            }

            AuditEvent auditEvent = mapper.mapToAuditEvent(envelope, record.topic());
            batchBuffer.add(auditEvent);

            // Feed to security incident detector for pattern analysis
            incidentDetector.analyze(envelope, record.topic());

            // Flush if batch size threshold reached
            if (batchBuffer.size() >= batchSize) {
                flushBatchBuffer();
            }
        } catch (Exception e) {
            log.error("Error processing audit event from topic {}: {}", record.topic(), e.getMessage(), e);
        }
    }

    /**
     * Periodic flush: every 5 seconds, flush any accumulated events.
     */
    @Scheduled(fixedRate = 5000)
    public void periodicFlush() {
        if (!batchBuffer.isEmpty()) {
            flushBatchBuffer();
        }
        evictExpiredFromFailureBuffer();
        retryFailureBuffer();
    }

    void flushBatchBuffer() {
        List<AuditEvent> batch = drainQueue(batchBuffer, batchSize);
        if (batch.isEmpty()) return;

        try {
            auditEventRepository.saveAll(batch);
            dbAvailable.set(true);
            log.debug("Flushed {} audit events to database", batch.size());
        } catch (Exception e) {
            log.error("Failed to persist {} audit events, moving to failure buffer: {}",
                    batch.size(), e.getMessage());
            dbAvailable.set(false);
            // Move to failure buffer
            Instant now = Instant.now();
            for (AuditEvent event : batch) {
                if (failureBuffer.size() < failureBufferMax) {
                    failureBuffer.add(new TimestampedEvent(event, now));
                } else {
                    log.warn("Failure buffer full ({} events), dropping audit event", failureBufferMax);
                    break;
                }
            }
        }
    }

    private void retryFailureBuffer() {
        if (failureBuffer.isEmpty() || !dbAvailable.get()) return;

        List<AuditEvent> retryBatch = new ArrayList<>();
        Iterator<TimestampedEvent> iter = failureBuffer.iterator();
        while (iter.hasNext() && retryBatch.size() < batchSize) {
            retryBatch.add(iter.next().event());
            iter.remove();
        }

        if (!retryBatch.isEmpty()) {
            try {
                auditEventRepository.saveAll(retryBatch);
                log.info("Successfully retried {} events from failure buffer", retryBatch.size());
            } catch (Exception e) {
                log.error("Retry of failure buffer failed: {}", e.getMessage());
                dbAvailable.set(false);
                Instant now = Instant.now();
                for (AuditEvent event : retryBatch) {
                    if (failureBuffer.size() < failureBufferMax) {
                        failureBuffer.add(new TimestampedEvent(event, now));
                    }
                }
            }
        }
    }

    private void evictExpiredFromFailureBuffer() {
        Instant cutoff = Instant.now().minusSeconds(failureBufferRetentionSeconds);
        failureBuffer.removeIf(te -> te.bufferedAt().isBefore(cutoff));
    }

    private <T> List<T> drainQueue(ConcurrentLinkedQueue<T> queue, int maxSize) {
        List<T> result = new ArrayList<>(maxSize);
        T item;
        while (result.size() < maxSize && (item = queue.poll()) != null) {
            result.add(item);
        }
        return result;
    }

    // ---- Monitoring ----

    public int getBatchBufferSize() {
        return batchBuffer.size();
    }

    public int getFailureBufferSize() {
        return failureBuffer.size();
    }

    public boolean isDbAvailable() {
        return dbAvailable.get();
    }

    // ---- Inner record ----

    record TimestampedEvent(AuditEvent event, Instant bufferedAt) {
    }
}
