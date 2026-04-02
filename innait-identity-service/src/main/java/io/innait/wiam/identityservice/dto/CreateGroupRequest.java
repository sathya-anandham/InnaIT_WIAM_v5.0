package io.innait.wiam.identityservice.dto;

import io.innait.wiam.identityservice.entity.GroupType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record CreateGroupRequest(
        @NotBlank @Size(max = 50) String groupCode,
        @NotBlank @Size(max = 100) String groupName,
        @Size(max = 500) String description,
        @NotNull GroupType groupType
) {
}
