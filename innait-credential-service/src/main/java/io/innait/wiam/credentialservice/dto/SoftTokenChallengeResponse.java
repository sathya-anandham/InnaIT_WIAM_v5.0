package io.innait.wiam.credentialservice.dto;

public record SoftTokenChallengeResponse(
        String challengeId,
        String status
) {
}
