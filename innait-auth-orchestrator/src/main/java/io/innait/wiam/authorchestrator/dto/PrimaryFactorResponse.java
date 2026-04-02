package io.innait.wiam.authorchestrator.dto;

import java.util.List;
import java.util.UUID;

public record PrimaryFactorResponse(
        UUID txnId,
        String state,
        boolean mfaRequired,
        List<String> mfaMethods,
        TokenSet tokens
) {
}
