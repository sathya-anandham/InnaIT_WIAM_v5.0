package io.innait.wiam.authorchestrator.dto;

import jakarta.validation.constraints.NotBlank;

public record AuthInitiateRequest(
        @NotBlank String loginId,
        String channelType,
        String sourceIp,
        String userAgent
) {
}
