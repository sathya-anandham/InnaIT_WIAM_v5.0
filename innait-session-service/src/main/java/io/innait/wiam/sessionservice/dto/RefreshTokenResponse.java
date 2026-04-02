package io.innait.wiam.sessionservice.dto;

import java.time.Instant;

public record RefreshTokenResponse(
        String refreshToken,
        Instant expiresAt
) {}
