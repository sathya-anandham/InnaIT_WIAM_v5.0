package io.innait.wiam.adminbff.dto;

import java.util.List;
import java.util.Map;

public record UserDetailResponse(
        Map<String, Object> profile,
        List<Map<String, Object>> accounts,
        List<Map<String, Object>> roles,
        Map<String, Object> credentialOverview,
        List<Map<String, Object>> activeSessions,
        List<Map<String, Object>> auditTrail
) {}
