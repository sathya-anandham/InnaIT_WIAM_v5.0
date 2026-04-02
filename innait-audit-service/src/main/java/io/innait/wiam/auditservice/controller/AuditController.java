package io.innait.wiam.auditservice.controller;

import io.innait.wiam.auditservice.dto.AdminActionRequest;
import io.innait.wiam.auditservice.dto.AdminActionResponse;
import io.innait.wiam.auditservice.dto.AuditEventResponse;
import io.innait.wiam.auditservice.dto.SecurityIncidentResponse;
import io.innait.wiam.auditservice.entity.EventCategory;
import io.innait.wiam.auditservice.entity.IncidentSeverity;
import io.innait.wiam.auditservice.entity.IncidentStatus;
import io.innait.wiam.auditservice.service.AdminActionLogger;
import io.innait.wiam.auditservice.service.AuditQueryService;
import io.innait.wiam.common.dto.ApiResponse;
import jakarta.validation.Valid;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/audit")
public class AuditController {

    private final AuditQueryService queryService;
    private final AdminActionLogger adminActionLogger;

    public AuditController(AuditQueryService queryService, AdminActionLogger adminActionLogger) {
        this.queryService = queryService;
        this.adminActionLogger = adminActionLogger;
    }

    // ---- Audit Events ----

    @GetMapping("/events")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN', 'TENANT_ADMIN')")
    public ResponseEntity<ApiResponse<Page<AuditEventResponse>>> queryAuditEvents(
            @RequestParam(required = false) EventCategory category,
            @RequestParam(required = false) String type,
            @RequestParam(required = false) UUID actorId,
            @RequestParam(required = false) UUID subjectId,
            @RequestParam(required = false) Instant fromTime,
            @RequestParam(required = false) Instant toTime,
            Pageable pageable) {
        return ResponseEntity.ok(ApiResponse.success(
                queryService.queryAuditEvents(category, type, actorId, subjectId, fromTime, toTime, pageable)));
    }

    @GetMapping("/events/trace/{correlationId}")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN', 'TENANT_ADMIN')")
    public ResponseEntity<ApiResponse<List<AuditEventResponse>>> traceByCorrelationId(
            @PathVariable UUID correlationId) {
        return ResponseEntity.ok(ApiResponse.success(queryService.traceByCorrelationId(correlationId)));
    }

    // ---- Admin Actions ----

    @GetMapping("/admin-actions")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN', 'TENANT_ADMIN')")
    public ResponseEntity<ApiResponse<Page<AdminActionResponse>>> queryAdminActions(
            @RequestParam(required = false) String targetType,
            @RequestParam(required = false) UUID targetId,
            Pageable pageable) {
        return ResponseEntity.ok(ApiResponse.success(
                queryService.queryAdminActions(targetType, targetId, pageable)));
    }

    @PostMapping("/admin-actions")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN', 'TENANT_ADMIN')")
    public ResponseEntity<ApiResponse<AdminActionResponse>> logAdminAction(
            @Valid @RequestBody AdminActionRequest request) {
        return ResponseEntity.ok(ApiResponse.success(adminActionLogger.logAction(request)));
    }

    // ---- Security Incidents ----

    @GetMapping("/security-incidents")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN', 'TENANT_ADMIN')")
    public ResponseEntity<ApiResponse<Page<SecurityIncidentResponse>>> querySecurityIncidents(
            @RequestParam(required = false) IncidentSeverity severity,
            @RequestParam(required = false) IncidentStatus status,
            Pageable pageable) {
        return ResponseEntity.ok(ApiResponse.success(
                queryService.querySecurityIncidents(severity, status, pageable)));
    }
}
