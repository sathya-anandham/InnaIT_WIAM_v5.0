package io.innait.wiam.adminconfigservice.dto;

import jakarta.validation.constraints.NotNull;

public record SetFeatureFlagRequest(
        @NotNull Boolean value
) {}
