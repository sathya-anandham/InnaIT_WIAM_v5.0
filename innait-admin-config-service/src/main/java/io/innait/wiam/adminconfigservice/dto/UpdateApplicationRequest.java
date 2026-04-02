package io.innait.wiam.adminconfigservice.dto;

import io.innait.wiam.adminconfigservice.entity.AppStatus;
import io.innait.wiam.adminconfigservice.entity.AppType;

public record UpdateApplicationRequest(
        String appName,
        AppType appType,
        AppStatus status,
        String appUrl,
        String description
) {}
