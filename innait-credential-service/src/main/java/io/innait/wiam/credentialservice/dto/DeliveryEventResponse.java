package io.innait.wiam.credentialservice.dto;

import java.time.Instant;
import java.util.UUID;

public record DeliveryEventResponse(
        UUID deliveryLogId,
        UUID deviceId,
        UUID deviceAssignmentId,
        String eventType,
        Instant eventTime,
        UUID handledBy,
        String comments
) {
}
