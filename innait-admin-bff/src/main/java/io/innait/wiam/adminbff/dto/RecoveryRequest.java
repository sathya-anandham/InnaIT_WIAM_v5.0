package io.innait.wiam.adminbff.dto;

import jakarta.validation.constraints.NotBlank;

public record RecoveryRequest(
        @NotBlank String loginId,
        @NotBlank String backupCode
) {}
