package io.innait.wiam.credentialservice.dto;

import java.time.Instant;
import java.util.UUID;

public record DeviceRegistryResponse(
        UUID deviceId,
        String deviceType,
        String deviceCategory,
        String deviceModel,
        String deviceVendor,
        String deviceSerialNo,
        String deviceUniqueRef,
        String deviceStatus,
        String ownershipMode,
        UUID procurementBatchId,
        Instant purchaseDate,
        Instant warrantyExpiry,
        boolean active,
        Instant createdAt,
        Instant updatedAt
) {
}
