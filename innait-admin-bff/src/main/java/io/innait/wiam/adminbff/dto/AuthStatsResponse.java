package io.innait.wiam.adminbff.dto;

public record AuthStatsResponse(
        long successCount,
        long failureCount,
        double successRate,
        long totalAttempts
) {
    public static AuthStatsResponse fromMap(java.util.Map<String, Object> map) {
        if (map == null) return new AuthStatsResponse(0, 0, 0.0, 0);
        return new AuthStatsResponse(
                toLong(map.get("successCount")),
                toLong(map.get("failureCount")),
                toDouble(map.get("successRate")),
                toLong(map.get("totalAttempts"))
        );
    }

    private static long toLong(Object val) {
        if (val instanceof Number n) return n.longValue();
        return 0;
    }

    private static double toDouble(Object val) {
        if (val instanceof Number n) return n.doubleValue();
        return 0.0;
    }
}
