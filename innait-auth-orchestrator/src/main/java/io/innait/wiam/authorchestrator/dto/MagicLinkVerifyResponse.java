package io.innait.wiam.authorchestrator.dto;

import java.util.UUID;

public record MagicLinkVerifyResponse(
        UUID txnId,
        String state,
        boolean verified,
        UUID bootstrapSessionId,
        boolean onboardingRequired
) {
}
