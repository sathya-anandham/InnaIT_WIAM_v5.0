package io.innait.wiam.credentialservice.dto;

import jakarta.validation.constraints.NotNull;

import java.util.UUID;

public record DeliveryEventRequest(
        @NotNull UUID deviceAssignmentId,
        @NotNull String eventType,
        String comments
) {
}
