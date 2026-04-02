package io.innait.wiam.identityservice.dto;

import jakarta.validation.constraints.Size;

public record UpdateGroupRequest(
        @Size(max = 100) String groupName,
        @Size(max = 500) String description
) {
}
