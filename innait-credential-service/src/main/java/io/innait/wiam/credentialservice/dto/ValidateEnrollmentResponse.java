package io.innait.wiam.credentialservice.dto;

import java.util.UUID;

public record ValidateEnrollmentResponse(
        boolean allowed,
        UUID deviceId,
        UUID accountId,
        String deviceStatus,
        String assignmentStatus,
        String reason
) {
}
