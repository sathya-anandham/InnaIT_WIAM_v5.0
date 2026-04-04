package io.innait.wiam.credentialservice.dto;

import java.time.Instant;
import java.util.UUID;

public record DeviceLifecycleEventResponse(
        UUID eventId,
        UUID deviceId,
        String eventType,
        String oldStatus,
        String newStatus,
        Instant eventTime,
        UUID actorId,
        String detail
) {
}
