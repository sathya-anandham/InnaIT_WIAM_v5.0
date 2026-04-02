package io.innait.wiam.credentialservice.dto;

import jakarta.validation.constraints.NotNull;

import java.util.UUID;

public record FidoRegistrationBeginRequest(
        @NotNull UUID accountId,
        String displayName
) {
}
