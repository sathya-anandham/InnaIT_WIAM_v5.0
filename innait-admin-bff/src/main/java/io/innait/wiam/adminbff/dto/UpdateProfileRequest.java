package io.innait.wiam.adminbff.dto;

import jakarta.validation.constraints.Size;

public record UpdateProfileRequest(
        @Size(max = 100) String firstName,
        @Size(max = 100) String lastName,
        @Size(max = 5) String phoneCountryCode,
        @Size(max = 20) String phoneNumber,
        @Size(max = 10) String locale,
        @Size(max = 50) String timezone
) {}
