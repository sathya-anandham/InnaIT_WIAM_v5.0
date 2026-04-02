package io.innait.wiam.authorchestrator.dto;

import jakarta.validation.constraints.NotNull;

import java.util.UUID;

public record StepUpInitiateRequest(
        @NotNull UUID sessionId,
        String requiredAcr
) {
}
