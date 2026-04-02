package io.innait.wiam.auditservice.health;

import io.innait.wiam.auditservice.service.AuditEventConsumer;
import org.springframework.boot.actuate.health.Health;
import org.springframework.boot.actuate.health.HealthIndicator;
import org.springframework.stereotype.Component;

/**
 * Health indicator that monitors the audit failure buffer.
 * WARN if buffer > 0, CRITICAL (DOWN) if buffer > 5,000.
 */
@Component
public class AuditBufferHealthIndicator implements HealthIndicator {

    private static final int WARN_THRESHOLD = 0;
    private static final int CRITICAL_THRESHOLD = 5000;

    private final AuditEventConsumer auditEventConsumer;

    public AuditBufferHealthIndicator(AuditEventConsumer auditEventConsumer) {
        this.auditEventConsumer = auditEventConsumer;
    }

    @Override
    public Health health() {
        int failureBufferSize = auditEventConsumer.getFailureBufferSize();
        int batchBufferSize = auditEventConsumer.getBatchBufferSize();
        boolean dbAvailable = auditEventConsumer.isDbAvailable();

        Health.Builder builder;
        if (failureBufferSize > CRITICAL_THRESHOLD) {
            builder = Health.down()
                    .withDetail("reason", "Failure buffer exceeds critical threshold");
        } else if (failureBufferSize > WARN_THRESHOLD) {
            builder = Health.status("WARN")
                    .withDetail("reason", "Events in failure buffer awaiting retry");
        } else {
            builder = Health.up();
        }

        return builder
                .withDetail("failureBufferSize", failureBufferSize)
                .withDetail("batchBufferSize", batchBufferSize)
                .withDetail("dbAvailable", dbAvailable)
                .build();
    }
}
