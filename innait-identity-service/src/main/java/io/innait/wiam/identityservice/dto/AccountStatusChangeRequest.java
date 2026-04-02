package io.innait.wiam.identityservice.dto;

import io.innait.wiam.common.constant.AccountStatus;
import jakarta.validation.constraints.NotNull;

import java.util.UUID;

public record AccountStatusChangeRequest(
        @NotNull AccountStatus status,
        String reason,
        UUID changedBy
) {
}
