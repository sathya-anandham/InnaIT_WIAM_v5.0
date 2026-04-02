package io.innait.wiam.authorchestrator.dto;

import java.time.Instant;
import java.util.UUID;

public record AuthStatusResponse(
        UUID txnId,
        String state,
        Instant startedAt,
        Instant expiresAt,
        Instant completedAt
) {
}
