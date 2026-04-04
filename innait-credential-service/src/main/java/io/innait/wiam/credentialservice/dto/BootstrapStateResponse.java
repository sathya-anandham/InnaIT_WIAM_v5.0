package io.innait.wiam.credentialservice.dto;

import java.time.Instant;
import java.util.UUID;

public record BootstrapStateResponse(
        UUID bootstrapStateId,
        UUID accountId,
        UUID userId,
        String bootstrapMethod,
        boolean bootstrapEnabled,
        boolean firstLoginPending,
        boolean fidoEnrolled,
        Instant magicLinkLastSentAt,
        Instant magicLinkLastVerifiedAt,
        Instant magicLinkExpiresAt,
        Instant magicLinkUsedAt,
        UUID lastMagicLinkTxnId
) {
}
