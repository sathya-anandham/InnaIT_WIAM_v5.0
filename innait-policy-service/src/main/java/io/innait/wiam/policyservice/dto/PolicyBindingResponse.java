package io.innait.wiam.policyservice.dto;

import java.util.UUID;

public record PolicyBindingResponse(
        UUID bindingId,
        String policyType,
        UUID policyId,
        String targetType,
        UUID targetId,
        boolean active
) {}
