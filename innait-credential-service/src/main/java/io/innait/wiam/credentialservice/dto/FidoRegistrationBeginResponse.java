package io.innait.wiam.credentialservice.dto;

import java.util.UUID;

public record FidoRegistrationBeginResponse(
        UUID txnId,
        String publicKeyCredentialCreationOptions
) {
}
