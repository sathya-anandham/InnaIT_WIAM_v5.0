package io.innait.wiam.policyservice.dto;

import java.util.List;
import java.util.UUID;

public record MfaPolicyResponse(
        UUID mfaPolicyId,
        String policyName,
        String enforcementMode,
        List<String> allowedMethods,
        int rememberDeviceDays,
        int gracePeriodDays,
        boolean isDefault,
        String status
) {}
