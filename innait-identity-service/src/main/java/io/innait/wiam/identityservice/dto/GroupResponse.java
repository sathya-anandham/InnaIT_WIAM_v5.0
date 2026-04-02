package io.innait.wiam.identityservice.dto;

import io.innait.wiam.identityservice.entity.ActiveStatus;
import io.innait.wiam.identityservice.entity.GroupType;

import java.time.Instant;
import java.util.UUID;

public record GroupResponse(
        UUID groupId,
        UUID tenantId,
        String groupCode,
        String groupName,
        String description,
        GroupType groupType,
        ActiveStatus status,
        Instant createdAt,
        Instant updatedAt
) {
}
