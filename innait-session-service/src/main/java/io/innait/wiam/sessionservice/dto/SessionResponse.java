package io.innait.wiam.sessionservice.dto;

import java.time.Instant;
import java.util.UUID;

public record SessionResponse(
        UUID sessionId,
        UUID accountId,
        String sessionType,
        String sessionStatus,
        int authLevel,
        Instant startedAt,
        Instant lastActivityAt,
        Instant expiresAt,
        Instant terminatedAt,
        String terminationReason,
        SessionContextResponse context
) {}
