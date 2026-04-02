package io.innait.wiam.adminbff.dto;

import java.util.List;
import java.util.Map;

public record DashboardResponse(
        UserCountsByStatus userCounts,
        long activeSessionCount,
        List<Map<String, Object>> recentAdminActions,
        AuthStatsResponse authStats
) {}
