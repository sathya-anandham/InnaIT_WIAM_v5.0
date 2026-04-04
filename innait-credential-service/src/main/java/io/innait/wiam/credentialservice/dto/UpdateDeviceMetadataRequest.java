package io.innait.wiam.credentialservice.dto;

import java.time.Instant;

public record UpdateDeviceMetadataRequest(
        String deviceVendor,
        String deviceModel,
        String deviceCategory,
        Instant warrantyExpiry
) {
}
