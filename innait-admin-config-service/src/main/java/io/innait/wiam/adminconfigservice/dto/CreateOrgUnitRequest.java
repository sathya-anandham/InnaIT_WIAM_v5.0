package io.innait.wiam.adminconfigservice.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.util.UUID;

public record CreateOrgUnitRequest(
        @NotBlank @Size(max = 100) String orgCode,
        @NotBlank @Size(max = 255) String orgName,
        UUID parentOrgUnitId,
        String description
) {}
