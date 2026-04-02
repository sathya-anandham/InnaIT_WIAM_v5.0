package io.innait.wiam.adminbff.dto;

import java.time.Instant;

public record AdminNotification(
        String type,
        String severity,
        String title,
        String message,
        Instant timestamp
) {}
