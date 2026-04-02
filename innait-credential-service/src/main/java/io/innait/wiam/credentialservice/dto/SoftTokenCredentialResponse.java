package io.innait.wiam.credentialservice.dto;

import java.time.Instant;
import java.util.UUID;

public record SoftTokenCredentialResponse(
        UUID credentialId,
        String deviceId,
        String deviceName,
        String devicePlatform,
        String activationStatus,
        Instant createdAt,
        Instant lastUsedAt
) {
}
