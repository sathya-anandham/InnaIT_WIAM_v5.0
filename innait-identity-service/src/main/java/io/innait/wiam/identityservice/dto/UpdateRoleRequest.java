package io.innait.wiam.identityservice.dto;

import jakarta.validation.constraints.Size;

public record UpdateRoleRequest(
        @Size(max = 100) String roleName,
        @Size(max = 500) String description
) {
}
