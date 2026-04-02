package io.innait.wiam.auditservice.dto;

import io.innait.wiam.auditservice.entity.AuditOutcome;
import io.innait.wiam.auditservice.entity.EventCategory;

import java.time.Instant;
import java.util.UUID;

public record AuditEventResponse(
        UUID auditEventId,
        UUID tenantId,
        UUID correlationId,
        String eventType,
        EventCategory eventCategory,
        UUID actorId,
        String actorType,
        String actorIp,
        UUID subjectId,
        String subjectType,
        String resourceType,
        UUID resourceId,
        String action,
        AuditOutcome outcome,
        String detail,
        String serviceName,
        Instant eventTime
) {
}
