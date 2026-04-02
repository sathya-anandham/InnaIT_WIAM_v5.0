package io.innait.wiam.identityservice.dto;

import io.innait.wiam.common.constant.RoleType;
import io.innait.wiam.identityservice.entity.ActiveStatus;

import java.time.Instant;
import java.util.UUID;

public record RoleResponse(
        UUID roleId,
        UUID tenantId,
        String roleCode,
        String roleName,
        String description,
        RoleType roleType,
        boolean system,
        ActiveStatus status,
        Instant createdAt,
        Instant updatedAt
) {
}
