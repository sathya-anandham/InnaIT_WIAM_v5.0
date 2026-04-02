package io.innait.wiam.adminconfigservice.dto;

import java.util.UUID;

public record UpdateOrgUnitRequest(
        String orgName,
        UUID parentOrgUnitId,
        String description
) {}
