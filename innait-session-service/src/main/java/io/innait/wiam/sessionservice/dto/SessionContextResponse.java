package io.innait.wiam.sessionservice.dto;

import java.math.BigDecimal;

public record SessionContextResponse(
        String ipAddress,
        String userAgent,
        String deviceFingerprint,
        String geoCountry,
        String geoRegion,
        String geoCity,
        BigDecimal deviceTrustScore
) {}
