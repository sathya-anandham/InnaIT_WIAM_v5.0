package io.innait.wiam.credentialservice.dto;

import java.time.Instant;
import java.util.UUID;

public record DeviceAssignmentResponse(
        UUID assignmentId,
        UUID deviceId,
        UUID userId,
        UUID accountId,
        String assignmentType,
        String assignmentStatus,
        String deliveryStatus,
        Instant assignedAt,
        Instant effectiveFrom,
        Instant effectiveTo,
        UUID assignedBy,
        boolean active,
        Instant createdAt
) {
}
