package io.innait.wiam.adminconfigservice.dto;

import jakarta.validation.constraints.NotBlank;

public record AddDomainRequest(
        @NotBlank String domainName
) {}
