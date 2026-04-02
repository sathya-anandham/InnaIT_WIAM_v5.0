package io.innait.wiam.credentialservice.dto;

import java.time.Instant;
import java.util.UUID;

public record FidoCredentialResponse(
        UUID credentialId,
        String fidoCredentialId,
        String displayName,
        String credentialStatus,
        boolean backupEligible,
        boolean backupState,
        long signCount,
        Instant createdAt,
        Instant lastUsedAt
) {
}
