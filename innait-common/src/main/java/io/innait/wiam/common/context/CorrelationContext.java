package io.innait.wiam.common.context;

import java.util.UUID;

public final class CorrelationContext {

    private static final ThreadLocal<UUID> CURRENT_CORRELATION = new ThreadLocal<>();

    private CorrelationContext() {
    }

    public static UUID getCorrelationId() {
        return CURRENT_CORRELATION.get();
    }

    public static UUID requireCorrelationId() {
        UUID correlationId = CURRENT_CORRELATION.get();
        if (correlationId == null) {
            correlationId = UUID.randomUUID();
            CURRENT_CORRELATION.set(correlationId);
        }
        return correlationId;
    }

    public static void setCorrelationId(UUID correlationId) {
        CURRENT_CORRELATION.set(correlationId);
    }

    public static void clear() {
        CURRENT_CORRELATION.remove();
    }
}
