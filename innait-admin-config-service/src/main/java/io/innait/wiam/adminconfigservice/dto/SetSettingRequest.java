package io.innait.wiam.adminconfigservice.dto;

import jakarta.validation.constraints.NotBlank;

public record SetSettingRequest(
        @NotBlank String value
) {}
