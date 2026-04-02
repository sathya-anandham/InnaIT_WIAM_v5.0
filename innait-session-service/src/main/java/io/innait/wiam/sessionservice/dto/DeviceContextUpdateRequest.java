package io.innait.wiam.sessionservice.dto;

import java.math.BigDecimal;

public record DeviceContextUpdateRequest(
        String deviceFingerprint,
        BigDecimal deviceTrustScore,
        String geoCountry,
        String geoRegion,
        String geoCity
) {}
