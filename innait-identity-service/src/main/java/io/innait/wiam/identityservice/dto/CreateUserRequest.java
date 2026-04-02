package io.innait.wiam.identityservice.dto;

import io.innait.wiam.common.constant.UserType;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.List;
import java.util.UUID;

public record CreateUserRequest(
        @NotBlank @Size(max = 100) String firstName,
        @NotBlank @Size(max = 100) String lastName,
        @Size(max = 255) String displayName,
        @NotBlank @Email @Size(max = 320) String email,
        @Size(max = 50) String employeeNo,
        @Size(max = 5) String phoneCountryCode,
        @Size(max = 30) String phoneNumber,
        @Size(max = 100) String department,
        @Size(max = 100) String designation,
        UUID managerUserId,
        UUID orgUnitId,
        @NotNull UserType userType,
        @Size(max = 10) String locale,
        @Size(max = 50) String timezone,
        boolean passwordEnabled,
        String creationMethod,
        List<UUID> defaultRoleIds,
        List<UUID> defaultGroupIds
) {
}
