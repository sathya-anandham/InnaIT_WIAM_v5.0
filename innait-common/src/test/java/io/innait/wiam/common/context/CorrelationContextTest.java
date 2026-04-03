package io.innait.wiam.common.context;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class CorrelationContextTest {

    @AfterEach
    void cleanup() {
        CorrelationContext.clear();
    }

    @Test
    void shouldReturnNullWhenNotSet() {
        assertThat(CorrelationContext.getCorrelationId()).isNull();
    }

    @Test
    void shouldSetAndGetCorrelationId() {
        UUID id = UUID.randomUUID();
        CorrelationContext.setCorrelationId(id);
        assertThat(CorrelationContext.getCorrelationId()).isEqualTo(id);
    }

    @Test
    void shouldGenerateIdWhenRequireCalledWithNoContext() {
        UUID id = CorrelationContext.requireCorrelationId();
        assertThat(id).isNotNull();
        assertThat(CorrelationContext.getCorrelationId()).isEqualTo(id);
    }

    @Test
    void shouldReturnExistingIdWhenRequireCalled() {
        UUID id = UUID.randomUUID();
        CorrelationContext.setCorrelationId(id);
        assertThat(CorrelationContext.requireCorrelationId()).isEqualTo(id);
    }

    @Test
    void shouldClearCorrelationId() {
        CorrelationContext.setCorrelationId(UUID.randomUUID());
        CorrelationContext.clear();
        assertThat(CorrelationContext.getCorrelationId()).isNull();
    }
}
