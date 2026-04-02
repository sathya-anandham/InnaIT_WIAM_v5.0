package io.innait.wiam.authorchestrator.dto;

public record TokenSet(
        String accessToken,
        String refreshToken,
        long expiresIn
) {
}
