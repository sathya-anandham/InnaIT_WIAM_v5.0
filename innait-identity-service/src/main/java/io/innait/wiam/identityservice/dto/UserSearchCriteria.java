package io.innait.wiam.identityservice.dto;

import io.innait.wiam.identityservice.entity.UserStatus;

public record UserSearchCriteria(
        String displayName,
        String email,
        UserStatus status,
        String department
) {
}
