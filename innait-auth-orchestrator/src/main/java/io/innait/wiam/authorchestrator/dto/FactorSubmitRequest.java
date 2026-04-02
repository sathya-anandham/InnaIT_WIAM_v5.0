package io.innait.wiam.authorchestrator.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.util.Map;
import java.util.UUID;

public record FactorSubmitRequest(
        @NotNull UUID txnId,
        @NotBlank String factorType,
        Map<String, String> factorData
) {
}
