package io.innait.wiam.identityservice.dto;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;

import java.util.List;
import java.util.UUID;

public record BulkRoleRequest(
        @NotEmpty List<@NotNull UUID> accountIds
) {
}
