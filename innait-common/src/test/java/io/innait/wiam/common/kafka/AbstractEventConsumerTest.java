package io.innait.wiam.common.kafka;

import io.innait.wiam.common.context.CorrelationContext;
import io.innait.wiam.common.context.TenantContext;
import io.innait.wiam.common.event.EventEnvelope;
import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.kafka.support.Acknowledgment;

import java.nio.charset.StandardCharsets;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.*;

class AbstractEventConsumerTest {

    private TestEventConsumer consumer;

    @BeforeEach
    void setUp() {
        consumer = new TestEventConsumer();
        TenantContext.clear();
        CorrelationContext.clear();
    }

    @AfterEach
    void tearDown() {
        TenantContext.clear();
        CorrelationContext.clear();
    }

    @Test
    void shouldSetTenantContextFromHeader() {
        UUID tenantId = UUID.randomUUID();
        UUID correlationId = UUID.randomUUID();
        AtomicReference<UUID> capturedTenant = new AtomicReference<>();

        consumer.setProcessCallback(envelope -> capturedTenant.set(TenantContext.getTenantId()));

        ConsumerRecord<String, EventEnvelope<String>> record = buildRecord(tenantId, correlationId, "test-payload");
        Acknowledgment ack = mock(Acknowledgment.class);

        consumer.onMessage(record, ack);

        assertThat(capturedTenant.get()).isEqualTo(tenantId);
        verify(ack).acknowledge();
    }

    @Test
    void shouldSetCorrelationContextFromHeader() {
        UUID tenantId = UUID.randomUUID();
        UUID correlationId = UUID.randomUUID();
        AtomicReference<UUID> capturedCorrelation = new AtomicReference<>();

        consumer.setProcessCallback(envelope -> capturedCorrelation.set(CorrelationContext.getCorrelationId()));

        ConsumerRecord<String, EventEnvelope<String>> record = buildRecord(tenantId, correlationId, "test-payload");
        Acknowledgment ack = mock(Acknowledgment.class);

        consumer.onMessage(record, ack);

        assertThat(capturedCorrelation.get()).isEqualTo(correlationId);
    }

    @Test
    void shouldClearContextsAfterProcessing() {
        UUID tenantId = UUID.randomUUID();
        ConsumerRecord<String, EventEnvelope<String>> record = buildRecord(tenantId, UUID.randomUUID(), "test");
        Acknowledgment ack = mock(Acknowledgment.class);

        consumer.onMessage(record, ack);

        assertThat(TenantContext.getTenantId()).isNull();
        assertThat(CorrelationContext.getCorrelationId()).isNull();
    }

    @Test
    void shouldSkipEventWithNoTenantId() {
        EventEnvelope<String> envelope = EventEnvelope.<String>builder()
                .eventType("test.event")
                .payload("data")
                .build();

        ConsumerRecord<String, EventEnvelope<String>> record = new ConsumerRecord<>(
                "test-topic", 0, 0L, null, envelope);

        Acknowledgment ack = mock(Acknowledgment.class);
        consumer.onMessage(record, ack);

        assertThat(consumer.wasProcessCalled()).isFalse();
        verify(ack).acknowledge();
    }

    @Test
    void shouldFallBackToEnvelopeTenantWhenNoHeader() {
        UUID tenantId = UUID.randomUUID();
        EventEnvelope<String> envelope = EventEnvelope.<String>builder()
                .eventType("test.event")
                .tenantId(tenantId)
                .payload("data")
                .build();

        // Record without tenant_id header
        ConsumerRecord<String, EventEnvelope<String>> record = new ConsumerRecord<>(
                "test-topic", 0, 0L, null, envelope);

        AtomicReference<UUID> capturedTenant = new AtomicReference<>();
        consumer.setProcessCallback(env -> capturedTenant.set(TenantContext.getTenantId()));

        Acknowledgment ack = mock(Acknowledgment.class);
        consumer.onMessage(record, ack);

        assertThat(capturedTenant.get()).isEqualTo(tenantId);
    }

    @Test
    void shouldClearContextsEvenOnError() {
        UUID tenantId = UUID.randomUUID();
        consumer.setProcessCallback(envelope -> { throw new RuntimeException("processing error"); });

        ConsumerRecord<String, EventEnvelope<String>> record = buildRecord(tenantId, UUID.randomUUID(), "data");
        Acknowledgment ack = mock(Acknowledgment.class);

        assertThatThrownBy(() -> consumer.onMessage(record, ack))
                .isInstanceOf(RuntimeException.class);

        assertThat(TenantContext.getTenantId()).isNull();
        assertThat(CorrelationContext.getCorrelationId()).isNull();
    }

    @Test
    void shouldNotAcknowledgeOnError() {
        UUID tenantId = UUID.randomUUID();
        consumer.setProcessCallback(envelope -> { throw new RuntimeException("fail"); });

        ConsumerRecord<String, EventEnvelope<String>> record = buildRecord(tenantId, UUID.randomUUID(), "data");
        Acknowledgment ack = mock(Acknowledgment.class);

        try {
            consumer.onMessage(record, ack);
        } catch (RuntimeException ignored) {
        }

        verifyNoInteractions(ack);
    }

    private ConsumerRecord<String, EventEnvelope<String>> buildRecord(UUID tenantId, UUID correlationId, String payload) {
        EventEnvelope<String> envelope = EventEnvelope.<String>builder()
                .eventType("test.event")
                .tenantId(tenantId)
                .correlationId(correlationId)
                .payload(payload)
                .build();

        ConsumerRecord<String, EventEnvelope<String>> record = new ConsumerRecord<>(
                "test-topic", 0, 0L, tenantId.toString(), envelope);
        record.headers().add("tenant_id", tenantId.toString().getBytes(StandardCharsets.UTF_8));
        record.headers().add("correlation_id", correlationId.toString().getBytes(StandardCharsets.UTF_8));
        return record;
    }

    /**
     * Test implementation of AbstractEventConsumer for verification.
     */
    static class TestEventConsumer extends AbstractEventConsumer<String> {

        private boolean processCalled = false;
        private java.util.function.Consumer<EventEnvelope<String>> callback = envelope -> {};

        void setProcessCallback(java.util.function.Consumer<EventEnvelope<String>> callback) {
            this.callback = callback;
        }

        boolean wasProcessCalled() {
            return processCalled;
        }

        @Override
        protected void process(EventEnvelope<String> envelope) {
            processCalled = true;
            callback.accept(envelope);
        }
    }
}
