package io.innait.wiam.authorchestrator.dto;

import jakarta.validation.constraints.NotNull;

import java.util.UUID;

public record BootstrapSessionValidateRequest(
        @NotNull UUID sessionId
) {
}
