package io.innait.wiam.auditservice.service;

import io.innait.wiam.auditservice.dto.AdminActionResponse;
import io.innait.wiam.auditservice.dto.AuditEventResponse;
import io.innait.wiam.auditservice.dto.SecurityIncidentResponse;
import io.innait.wiam.auditservice.entity.*;
import io.innait.wiam.auditservice.repository.AdminActionRepository;
import io.innait.wiam.auditservice.repository.AuditEventRepository;
import io.innait.wiam.auditservice.repository.SecurityIncidentRepository;
import io.innait.wiam.common.context.TenantContext;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Service
@Transactional(readOnly = true)
public class AuditQueryService {

    private final AuditEventRepository auditEventRepository;
    private final AdminActionRepository adminActionRepository;
    private final SecurityIncidentRepository securityIncidentRepository;

    public AuditQueryService(AuditEventRepository auditEventRepository,
                             AdminActionRepository adminActionRepository,
                             SecurityIncidentRepository securityIncidentRepository) {
        this.auditEventRepository = auditEventRepository;
        this.adminActionRepository = adminActionRepository;
        this.securityIncidentRepository = securityIncidentRepository;
    }

    public Page<AuditEventResponse> queryAuditEvents(EventCategory category, String eventType,
                                                      UUID actorId, UUID subjectId,
                                                      Instant fromTime, Instant toTime,
                                                      Pageable pageable) {
        UUID tenantId = TenantContext.requireTenantId();
        return auditEventRepository.findByFilters(tenantId, category, eventType,
                        actorId, subjectId, fromTime, toTime, pageable)
                .map(this::toAuditEventResponse);
    }

    public List<AuditEventResponse> traceByCorrelationId(UUID correlationId) {
        return auditEventRepository.findByCorrelationId(correlationId).stream()
                .map(this::toAuditEventResponse)
                .toList();
    }

    public Page<AdminActionResponse> queryAdminActions(String targetType, UUID targetId,
                                                        Pageable pageable) {
        UUID tenantId = TenantContext.requireTenantId();
        return adminActionRepository.findByFilters(tenantId, targetType, targetId, pageable)
                .map(this::toAdminActionResponse);
    }

    public Page<SecurityIncidentResponse> querySecurityIncidents(IncidentSeverity severity,
                                                                  IncidentStatus status,
                                                                  Pageable pageable) {
        UUID tenantId = TenantContext.requireTenantId();
        return securityIncidentRepository.findByFilters(tenantId, severity, status, pageable)
                .map(this::toSecurityIncidentResponse);
    }

    private AuditEventResponse toAuditEventResponse(AuditEvent e) {
        return new AuditEventResponse(
                e.getAuditEventId(), e.getTenantId(), e.getCorrelationId(),
                e.getEventType(), e.getEventCategory(),
                e.getActorId(), e.getActorType(), e.getActorIp(),
                e.getSubjectId(), e.getSubjectType(),
                e.getResourceType(), e.getResourceId(),
                e.getAction(), e.getOutcome(), e.getDetail(),
                e.getServiceName(), e.getEventTime()
        );
    }

    private AdminActionResponse toAdminActionResponse(AdminAction a) {
        return new AdminActionResponse(
                a.getAdminActionId(), a.getTenantId(), a.getAdminId(),
                a.getActionType(), a.getTargetType(), a.getTargetId(),
                a.getBeforeState(), a.getAfterState(),
                a.getJustification(), a.getActionTime()
        );
    }

    private SecurityIncidentResponse toSecurityIncidentResponse(SecurityIncident s) {
        return new SecurityIncidentResponse(
                s.getIncidentId(), s.getTenantId(), s.getIncidentType(),
                s.getSeverity(), s.getSourceIp(), s.getAccountId(),
                s.getDescription(), s.getDetail(), s.getStatus(),
                s.getResolvedAt(), s.getResolvedBy(), s.getDetectedAt()
        );
    }
}
