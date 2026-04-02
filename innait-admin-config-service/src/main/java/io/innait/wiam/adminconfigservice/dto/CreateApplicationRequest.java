package io.innait.wiam.adminconfigservice.dto;

import io.innait.wiam.adminconfigservice.entity.AppType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record CreateApplicationRequest(
        @NotBlank @Size(max = 100) String appCode,
        @NotBlank @Size(max = 255) String appName,
        @NotNull AppType appType,
        String appUrl,
        String description
) {}
