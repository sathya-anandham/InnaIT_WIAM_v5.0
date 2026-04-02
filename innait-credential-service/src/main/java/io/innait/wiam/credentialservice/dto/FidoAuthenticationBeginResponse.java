package io.innait.wiam.credentialservice.dto;

import java.util.UUID;

public record FidoAuthenticationBeginResponse(
        UUID txnId,
        String publicKeyCredentialRequestOptions
) {
}
