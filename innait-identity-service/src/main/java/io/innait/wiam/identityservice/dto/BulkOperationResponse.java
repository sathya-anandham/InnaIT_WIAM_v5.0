package io.innait.wiam.identityservice.dto;

import java.time.Instant;
import java.util.UUID;

public record BulkOperationResponse(
        UUID jobId,
        String operationType,
        String status,
        int totalRecords,
        int successCount,
        int failureCount,
        Instant startedAt,
        Instant completedAt
) {
}
