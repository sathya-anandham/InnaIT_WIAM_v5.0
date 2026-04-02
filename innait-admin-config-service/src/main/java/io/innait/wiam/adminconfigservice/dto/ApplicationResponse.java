package io.innait.wiam.adminconfigservice.dto;

import io.innait.wiam.adminconfigservice.entity.AppStatus;
import io.innait.wiam.adminconfigservice.entity.AppType;

import java.util.UUID;

public record ApplicationResponse(
        UUID appId,
        UUID tenantId,
        String appCode,
        String appName,
        AppType appType,
        AppStatus status,
        String appUrl,
        String description
) {}
