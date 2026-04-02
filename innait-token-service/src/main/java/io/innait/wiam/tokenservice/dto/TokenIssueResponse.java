package io.innait.wiam.tokenservice.dto;

public record TokenIssueResponse(
        String accessToken,
        String refreshToken,
        long expiresIn,
        String tokenType
) {}
