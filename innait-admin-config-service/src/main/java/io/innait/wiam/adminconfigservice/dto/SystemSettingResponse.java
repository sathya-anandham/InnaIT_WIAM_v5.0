package io.innait.wiam.adminconfigservice.dto;

import io.innait.wiam.adminconfigservice.entity.SettingValueType;

import java.util.UUID;

public record SystemSettingResponse(
        UUID settingId,
        UUID tenantId,
        String settingKey,
        String settingValue,
        SettingValueType valueType,
        String description,
        boolean sensitive,
        boolean tenantOverride
) {}
