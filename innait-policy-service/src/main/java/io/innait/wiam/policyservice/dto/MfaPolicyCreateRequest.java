package io.innait.wiam.policyservice.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.util.List;

public record MfaPolicyCreateRequest(
        @NotBlank String policyName,
        @NotNull String enforcementMode,
        List<String> allowedMethods,
        int rememberDeviceDays,
        int gracePeriodDays,
        boolean isDefault
) {}
