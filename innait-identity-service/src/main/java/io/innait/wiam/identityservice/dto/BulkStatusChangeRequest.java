package io.innait.wiam.identityservice.dto;

import io.innait.wiam.common.constant.AccountStatus;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;

import java.util.List;
import java.util.UUID;

public record BulkStatusChangeRequest(
        @NotEmpty List<@NotNull UUID> accountIds,
        @NotNull AccountStatus targetStatus
) {
}
