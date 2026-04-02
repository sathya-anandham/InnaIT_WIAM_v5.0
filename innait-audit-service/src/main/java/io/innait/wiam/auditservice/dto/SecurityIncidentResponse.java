package io.innait.wiam.auditservice.dto;

import io.innait.wiam.auditservice.entity.IncidentSeverity;
import io.innait.wiam.auditservice.entity.IncidentStatus;
import io.innait.wiam.auditservice.entity.IncidentType;

import java.time.Instant;
import java.util.UUID;

public record SecurityIncidentResponse(
        UUID incidentId,
        UUID tenantId,
        IncidentType incidentType,
        IncidentSeverity severity,
        String sourceIp,
        UUID accountId,
        String description,
        String detail,
        IncidentStatus status,
        Instant resolvedAt,
        UUID resolvedBy,
        Instant detectedAt
) {
}
