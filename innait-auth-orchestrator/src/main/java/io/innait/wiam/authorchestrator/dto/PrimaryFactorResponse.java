package io.innait.wiam.authorchestrator.dto;

import java.util.List;
import java.util.UUID;

public record PrimaryFactorResponse(
        UUID txnId,
        String status,
        boolean mfaRequired,
        List<String> availableMfaMethods,
        TokenSet tokens,
        // Identity fields — populated only when status=AUTHENTICATED
        String sessionId,
        UUID accountId,
        String userId,
        String loginId,
        String displayName,
        List<String> roles,
        List<String> groups,
        List<String> amr,
        String acr
) {
}
