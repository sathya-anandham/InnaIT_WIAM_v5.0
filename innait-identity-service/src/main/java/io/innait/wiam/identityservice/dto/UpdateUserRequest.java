package io.innait.wiam.identityservice.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Size;

import java.util.UUID;

public record UpdateUserRequest(
        @Size(max = 100) String firstName,
        @Size(max = 100) String lastName,
        @Size(max = 255) String displayName,
        @Email @Size(max = 320) String email,
        @Size(max = 50) String employeeNo,
        @Size(max = 5) String phoneCountryCode,
        @Size(max = 30) String phoneNumber,
        @Size(max = 100) String department,
        @Size(max = 100) String designation,
        UUID managerUserId,
        UUID orgUnitId,
        @Size(max = 10) String locale,
        @Size(max = 50) String timezone
) {
}
