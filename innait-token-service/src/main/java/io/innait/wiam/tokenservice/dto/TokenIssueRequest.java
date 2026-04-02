package io.innait.wiam.tokenservice.dto;

import jakarta.validation.constraints.NotNull;

import java.util.List;
import java.util.UUID;

public record TokenIssueRequest(
        @NotNull UUID sessionId,
        @NotNull UUID accountId,
        @NotNull UUID tenantId,
        String loginId,
        List<String> roles,
        List<String> groups,
        List<String> amr,
        String acr
) {}
