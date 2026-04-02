package io.innait.wiam.identityservice.dto;

import io.innait.wiam.common.constant.RoleType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record CreateRoleRequest(
        @NotBlank @Size(max = 50) String roleCode,
        @NotBlank @Size(max = 100) String roleName,
        @Size(max = 500) String description,
        @NotNull RoleType roleType,
        boolean system
) {
}
