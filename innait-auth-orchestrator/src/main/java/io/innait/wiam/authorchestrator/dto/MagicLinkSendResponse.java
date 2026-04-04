package io.innait.wiam.authorchestrator.dto;

import java.time.Instant;
import java.util.UUID;

public record MagicLinkSendResponse(
        UUID txnId,
        String state,
        Instant expiresAt
) {
}
