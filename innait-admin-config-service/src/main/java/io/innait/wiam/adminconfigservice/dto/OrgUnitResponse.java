package io.innait.wiam.adminconfigservice.dto;

import io.innait.wiam.adminconfigservice.entity.OrgUnitStatus;

import java.util.UUID;

public record OrgUnitResponse(
        UUID orgUnitId,
        UUID tenantId,
        String orgCode,
        String orgName,
        UUID parentOrgUnitId,
        String description,
        OrgUnitStatus status
) {}
