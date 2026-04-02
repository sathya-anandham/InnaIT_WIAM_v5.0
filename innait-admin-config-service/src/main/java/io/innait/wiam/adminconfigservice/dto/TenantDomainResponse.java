package io.innait.wiam.adminconfigservice.dto;

import io.innait.wiam.adminconfigservice.entity.DomainVerificationStatus;

import java.time.Instant;
import java.util.UUID;

public record TenantDomainResponse(
        UUID domainId,
        UUID tenantId,
        String domainName,
        DomainVerificationStatus verificationStatus,
        String verificationToken,
        Instant verifiedAt,
        boolean primary
) {}
