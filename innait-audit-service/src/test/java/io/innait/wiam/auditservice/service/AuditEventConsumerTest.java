package io.innait.wiam.auditservice.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import io.innait.wiam.auditservice.repository.AuditEventRepository;
import io.innait.wiam.auditservice.repository.SecurityIncidentRepository;
import io.innait.wiam.common.event.EventEnvelope;
import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.StringRedisTemplate;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AuditEventConsumerTest {

    @Mock private AuditEventRepository auditEventRepository;
    @Mock private SecurityIncidentRepository incidentRepository;
    @Mock private StringRedisTemplate redisTemplate;

    private AuditEventConsumer consumer;
    private AuditEventMapper mapper;
    private SecurityIncidentDetector detector;

    @BeforeEach
    void setUp() {
        mapper = new AuditEventMapper(new ObjectMapper());
        detector = new SecurityIncidentDetector(incidentRepository, redisTemplate, new ObjectMapper());
        consumer = new AuditEventConsumer(auditEventRepository, mapper, detector);
        // Set batch size via reflection for testing
        setField(consumer, "batchSize", 5);
        setField(consumer, "failureBufferMax", 100);
        setField(consumer, "failureBufferRetentionSeconds", 300L);
    }

    @Nested
    class BatchBuffering {

        @Test
        void shouldAccumulateEventsInBatchBuffer() {
            for (int i = 0; i < 3; i++) {
                consumer.onEvent(createRecord("innait.identity.user.created", "user.created"));
            }

            assertThat(consumer.getBatchBufferSize()).isEqualTo(3);
            verify(auditEventRepository, never()).saveAll(anyList());
        }

        @Test
        void shouldFlushWhenBatchSizeReached() {
            when(auditEventRepository.saveAll(anyList())).thenReturn(List.of());

            for (int i = 0; i < 5; i++) {
                consumer.onEvent(createRecord("innait.identity.user.created", "user.created"));
            }

            verify(auditEventRepository).saveAll(anyList());
        }

        @Test
        void shouldFlushOnPeriodicTrigger() {
            when(auditEventRepository.saveAll(anyList())).thenReturn(List.of());

            consumer.onEvent(createRecord("innait.identity.user.created", "user.created"));
            assertThat(consumer.getBatchBufferSize()).isEqualTo(1);

            consumer.periodicFlush();

            verify(auditEventRepository).saveAll(anyList());
        }
    }

    @Nested
    class FailureBuffer {

        @Test
        void shouldMoveToFailureBufferOnDbError() {
            when(auditEventRepository.saveAll(anyList()))
                    .thenThrow(new RuntimeException("DB unavailable"));

            for (int i = 0; i < 5; i++) {
                consumer.onEvent(createRecord("innait.identity.user.created", "user.created"));
            }

            assertThat(consumer.getFailureBufferSize()).isGreaterThan(0);
            assertThat(consumer.isDbAvailable()).isFalse();
        }

        @Test
        void shouldNotExceedFailureBufferMax() {
            when(auditEventRepository.saveAll(anyList()))
                    .thenThrow(new RuntimeException("DB unavailable"));

            // Fill beyond max (100)
            for (int i = 0; i < 150; i++) {
                consumer.onEvent(createRecord("innait.identity.user.created", "user.created"));
            }

            assertThat(consumer.getFailureBufferSize()).isLessThanOrEqualTo(100);
        }

        @Test
        void shouldRetryFailureBufferWhenDbRecovers() {
            // First call fails, second succeeds
            when(auditEventRepository.saveAll(anyList()))
                    .thenThrow(new RuntimeException("DB unavailable"))
                    .thenReturn(List.of());

            // Fill batch to trigger flush (which fails)
            for (int i = 0; i < 5; i++) {
                consumer.onEvent(createRecord("innait.identity.user.created", "user.created"));
            }
            int failedCount = consumer.getFailureBufferSize();
            assertThat(failedCount).isGreaterThan(0);

            // Simulate DB recovery
            setField(consumer, "dbAvailable", new java.util.concurrent.atomic.AtomicBoolean(true));

            // Trigger retry
            consumer.periodicFlush();

            // Should have attempted retry
            verify(auditEventRepository, atLeast(2)).saveAll(anyList());
        }
    }

    @Nested
    class EventProcessing {

        @Test
        void shouldSkipNullEnvelope() {
            ConsumerRecord<String, EventEnvelope<?>> record = new ConsumerRecord<>(
                    "innait.identity.user.created", 0, 0, null, null);

            consumer.onEvent(record);

            assertThat(consumer.getBatchBufferSize()).isEqualTo(0);
        }

        @Test
        void shouldSkipEventWithNullTenant() {
            EventEnvelope<Map<String, Object>> envelope = new EventEnvelope<>(
                    UUID.randomUUID(), "v1", "user.created",
                    null, null, Instant.now(), null, null, null, Map.of());

            ConsumerRecord<String, EventEnvelope<?>> record = new ConsumerRecord<>(
                    "innait.identity.user.created", 0, 0, null, envelope);

            consumer.onEvent(record);

            assertThat(consumer.getBatchBufferSize()).isEqualTo(0);
        }
    }

    // ---- Helpers ----

    private ConsumerRecord<String, EventEnvelope<?>> createRecord(String topic, String eventType) {
        EventEnvelope<Map<String, Object>> envelope = new EventEnvelope<>(
                UUID.randomUUID(), "v1", eventType,
                UUID.randomUUID(), UUID.randomUUID(), Instant.now(),
                UUID.randomUUID(), "SYSTEM", null, Map.of());
        return new ConsumerRecord<>(topic, 0, 0, null, envelope);
    }

    private void setField(Object target, String fieldName, Object value) {
        try {
            var field = target.getClass().getDeclaredField(fieldName);
            field.setAccessible(true);
            field.set(target, value);
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }
}
