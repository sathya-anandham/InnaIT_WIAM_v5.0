package io.innait.wiam.credentialservice.dto;

import java.util.UUID;

public record SoftTokenProvisionResponse(
        UUID credentialId,
        String deviceId,
        String activationUrl,
        String publicKey
) {
}
