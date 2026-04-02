package io.innait.wiam.policyservice.dto;

import jakarta.validation.constraints.NotNull;

import java.util.List;
import java.util.Map;
import java.util.UUID;

public record PolicySimulateRequest(
        @NotNull UUID accountId,
        List<UUID> groupIds,
        List<UUID> roleIds,
        Map<String, Object> context
) {}
