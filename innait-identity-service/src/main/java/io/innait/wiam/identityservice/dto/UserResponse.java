package io.innait.wiam.identityservice.dto;

import io.innait.wiam.common.constant.UserType;
import io.innait.wiam.identityservice.entity.UserStatus;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record UserResponse(
        UUID userId,
        UUID tenantId,
        String employeeNo,
        String firstName,
        String lastName,
        String displayName,
        String email,
        String phoneCountryCode,
        String phoneNumber,
        String department,
        String designation,
        UUID managerUserId,
        UUID orgUnitId,
        UserType userType,
        UserStatus status,
        String locale,
        String timezone,
        List<AccountSummary> accounts,
        Instant createdAt,
        Instant updatedAt
) {

    public record AccountSummary(
            UUID accountId,
            String loginId,
            String accountStatus
    ) {
    }
}
