package io.innait.wiam.identityservice.dto;

import java.util.UUID;

public record RoleRemovalRequest(
        UUID removedBy,
        String reason,
        String revocationSource
) {
}
