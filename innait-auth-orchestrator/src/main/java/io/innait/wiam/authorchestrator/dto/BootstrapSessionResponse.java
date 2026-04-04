package io.innait.wiam.authorchestrator.dto;

import java.util.UUID;

public record BootstrapSessionResponse(
        UUID sessionId,
        UUID accountId,
        UUID tenantId,
        UUID userId,
        String type,
        boolean valid
) {
}
