package io.innait.wiam.credentialservice.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.time.Instant;
import java.util.UUID;

public record RegisterDeviceRequest(
        @NotNull String deviceType,
        @NotBlank String deviceUniqueRef,
        String deviceSerialNo,
        String deviceVendor,
        String deviceModel,
        String deviceCategory,
        UUID procurementBatchId,
        Instant purchaseDate,
        Instant warrantyExpiry
) {
}
