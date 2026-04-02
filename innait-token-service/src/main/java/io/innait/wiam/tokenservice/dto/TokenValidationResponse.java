package io.innait.wiam.tokenservice.dto;

import java.util.List;
import java.util.Map;
import java.util.UUID;

public record TokenValidationResponse(
        boolean active,
        UUID accountId,
        UUID tenantId,
        UUID sessionId,
        String loginId,
        List<String> roles,
        List<String> groups,
        List<String> amr,
        String acr,
        long exp,
        long iat,
        Map<String, Object> allClaims
) {}
