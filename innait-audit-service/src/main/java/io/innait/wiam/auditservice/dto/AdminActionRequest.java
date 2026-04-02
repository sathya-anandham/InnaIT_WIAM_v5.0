package io.innait.wiam.auditservice.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.util.UUID;

public record AdminActionRequest(
        @NotNull UUID adminId,
        @NotBlank String actionType,
        @NotBlank String targetType,
        @NotNull UUID targetId,
        Object beforeState,
        Object afterState,
        String justification
) {
}
