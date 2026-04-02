package io.innait.wiam.authorchestrator.dto;

import java.util.UUID;

public record MfaFactorResponse(
        UUID txnId,
        String state,
        TokenSet tokens
) {
}
