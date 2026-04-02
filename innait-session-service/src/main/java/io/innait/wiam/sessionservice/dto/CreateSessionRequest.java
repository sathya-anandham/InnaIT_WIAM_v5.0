package io.innait.wiam.sessionservice.dto;

import jakarta.validation.constraints.NotNull;

import java.util.List;
import java.util.UUID;

public record CreateSessionRequest(
        @NotNull UUID accountId,
        UUID authTxnId,
        List<String> authMethodsUsed,
        int acrLevel,
        String sessionType,
        @NotNull String ipAddress,
        String userAgent,
        String deviceFingerprint,
        String geoCountry,
        String geoRegion,
        String geoCity
) {}
