package io.innait.wiam.adminbff.dto;

public record UserCountsByStatus(
        long active,
        long suspended,
        long locked,
        long terminated,
        long total
) {
    public static UserCountsByStatus fromMap(java.util.Map<String, Object> map) {
        if (map == null) return new UserCountsByStatus(0, 0, 0, 0, 0);
        return new UserCountsByStatus(
                toLong(map.get("active")),
                toLong(map.get("suspended")),
                toLong(map.get("locked")),
                toLong(map.get("terminated")),
                toLong(map.get("total"))
        );
    }

    private static long toLong(Object val) {
        if (val instanceof Number n) return n.longValue();
        return 0;
    }
}
