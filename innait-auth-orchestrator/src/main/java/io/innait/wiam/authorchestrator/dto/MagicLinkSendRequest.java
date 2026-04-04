package io.innait.wiam.authorchestrator.dto;

import jakarta.validation.constraints.NotNull;

import java.util.UUID;

public record MagicLinkSendRequest(
        @NotNull UUID txnId,
        @NotNull UUID accountId,
        String email
) {
}
