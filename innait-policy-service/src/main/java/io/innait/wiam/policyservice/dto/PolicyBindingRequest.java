package io.innait.wiam.policyservice.dto;

import jakarta.validation.constraints.NotNull;

import java.util.UUID;

public record PolicyBindingRequest(
        @NotNull String policyType,
        @NotNull UUID policyId,
        @NotNull String targetType,
        @NotNull UUID targetId
) {}
