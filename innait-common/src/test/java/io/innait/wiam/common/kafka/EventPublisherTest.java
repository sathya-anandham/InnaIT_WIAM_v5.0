package io.innait.wiam.common.kafka;

import io.innait.wiam.common.context.CorrelationContext;
import io.innait.wiam.common.event.EventEnvelope;
import org.apache.kafka.clients.producer.ProducerRecord;
import org.apache.kafka.common.header.Header;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.kafka.support.SendResult;

import java.nio.charset.StandardCharsets;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class EventPublisherTest {

    @Mock
    private KafkaTemplate<String, Object> kafkaTemplate;

    @Captor
    private ArgumentCaptor<ProducerRecord<String, Object>> recordCaptor;

    private EventPublisher publisher;

    @BeforeEach
    void setUp() {
        publisher = new EventPublisher(kafkaTemplate);
        CorrelationContext.clear();
    }

    @AfterEach
    void tearDown() {
        CorrelationContext.clear();
    }

    @Test
    void shouldSetTenantIdHeader() {
        UUID tenantId = UUID.randomUUID();
        EventEnvelope<String> event = EventEnvelope.<String>builder()
                .eventType("test.event")
                .tenantId(tenantId)
                .payload("test")
                .build();

        when(kafkaTemplate.send(any(ProducerRecord.class))).thenReturn(new CompletableFuture<>());

        publisher.publish("test-topic", event);

        verify(kafkaTemplate).send(recordCaptor.capture());
        ProducerRecord<String, Object> record = recordCaptor.getValue();

        String headerValue = extractHeader(record, "tenant_id");
        assertThat(headerValue).isEqualTo(tenantId.toString());
    }

    @Test
    void shouldSetCorrelationIdHeaderFromEnvelope() {
        UUID correlationId = UUID.randomUUID();
        EventEnvelope<String> event = EventEnvelope.<String>builder()
                .eventType("test.event")
                .tenantId(UUID.randomUUID())
                .correlationId(correlationId)
                .payload("test")
                .build();

        when(kafkaTemplate.send(any(ProducerRecord.class))).thenReturn(new CompletableFuture<>());

        publisher.publish("test-topic", event);

        verify(kafkaTemplate).send(recordCaptor.capture());
        String headerValue = extractHeader(recordCaptor.getValue(), "correlation_id");
        assertThat(headerValue).isEqualTo(correlationId.toString());
    }

    @Test
    void shouldFallBackToCorrelationContext() {
        UUID contextCorrelationId = UUID.randomUUID();
        CorrelationContext.setCorrelationId(contextCorrelationId);

        // Event without correlation_id
        EventEnvelope<String> event = EventEnvelope.<String>builder()
                .eventType("test.event")
                .tenantId(UUID.randomUUID())
                .payload("test")
                .build();

        when(kafkaTemplate.send(any(ProducerRecord.class))).thenReturn(new CompletableFuture<>());

        publisher.publish("test-topic", event);

        verify(kafkaTemplate).send(recordCaptor.capture());
        String headerValue = extractHeader(recordCaptor.getValue(), "correlation_id");
        assertThat(headerValue).isEqualTo(contextCorrelationId.toString());
    }

    @Test
    void shouldSetEventTypeHeader() {
        EventEnvelope<String> event = EventEnvelope.<String>builder()
                .eventType("innait.identity.user.created")
                .tenantId(UUID.randomUUID())
                .payload("test")
                .build();

        when(kafkaTemplate.send(any(ProducerRecord.class))).thenReturn(new CompletableFuture<>());

        publisher.publish("test-topic", event);

        verify(kafkaTemplate).send(recordCaptor.capture());
        String headerValue = extractHeader(recordCaptor.getValue(), "event_type");
        assertThat(headerValue).isEqualTo("innait.identity.user.created");
    }

    @Test
    void shouldUseTenantIdAsPartitionKey() {
        UUID tenantId = UUID.randomUUID();
        EventEnvelope<String> event = EventEnvelope.<String>builder()
                .eventType("test.event")
                .tenantId(tenantId)
                .payload("test")
                .build();

        when(kafkaTemplate.send(any(ProducerRecord.class))).thenReturn(new CompletableFuture<>());

        publisher.publish("test-topic", event);

        verify(kafkaTemplate).send(recordCaptor.capture());
        assertThat(recordCaptor.getValue().key()).isEqualTo(tenantId.toString());
    }

    @Test
    void shouldSendToCorrectTopic() {
        EventEnvelope<String> event = EventEnvelope.<String>builder()
                .eventType("test.event")
                .tenantId(UUID.randomUUID())
                .payload("data")
                .build();

        when(kafkaTemplate.send(any(ProducerRecord.class))).thenReturn(new CompletableFuture<>());

        publisher.publish(InnaITTopics.USER_CREATED, event);

        verify(kafkaTemplate).send(recordCaptor.capture());
        assertThat(recordCaptor.getValue().topic()).isEqualTo(InnaITTopics.USER_CREATED);
    }

    private String extractHeader(ProducerRecord<String, Object> record, String headerName) {
        Header header = record.headers().lastHeader(headerName);
        if (header == null) return null;
        return new String(header.value(), StandardCharsets.UTF_8);
    }
}
