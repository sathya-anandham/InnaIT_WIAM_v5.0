package io.innait.wiam.auditservice.entity;

import jakarta.persistence.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "SECURITY_INCIDENTS")
public class SecurityIncident {

    @Id
    @Column(name = "INCIDENT_ID", columnDefinition = "RAW(16)")
    private UUID incidentId;

    @Column(name = "TENANT_ID", nullable = false, columnDefinition = "RAW(16)")
    private UUID tenantId;

    @Enumerated(EnumType.STRING)
    @Column(name = "INCIDENT_TYPE", length = 50)
    private IncidentType incidentType;

    @Enumerated(EnumType.STRING)
    @Column(name = "SEVERITY", length = 10)
    private IncidentSeverity severity;

    @Column(name = "SOURCE_IP", length = 45)
    private String sourceIp;

    @Column(name = "ACCOUNT_ID", columnDefinition = "RAW(16)")
    private UUID accountId;

    @Column(name = "DESCRIPTION", length = 1000)
    private String description;

    @JdbcTypeCode(SqlTypes.CLOB)
    @Column(name = "DETAIL")
    private String detail;

    @Enumerated(EnumType.STRING)
    @Column(name = "STATUS", length = 20)
    private IncidentStatus status;

    @Column(name = "RESOLVED_AT")
    private Instant resolvedAt;

    @Column(name = "RESOLVED_BY", columnDefinition = "RAW(16)")
    private UUID resolvedBy;

    @Column(name = "DETECTED_AT")
    private Instant detectedAt;

    protected SecurityIncident() {
    }

    public SecurityIncident(UUID incidentId, UUID tenantId, IncidentType incidentType,
                            IncidentSeverity severity, String sourceIp, UUID accountId,
                            String description, String detail, IncidentStatus status,
                            Instant detectedAt) {
        this.incidentId = incidentId;
        this.tenantId = tenantId;
        this.incidentType = incidentType;
        this.severity = severity;
        this.sourceIp = sourceIp;
        this.accountId = accountId;
        this.description = description;
        this.detail = detail;
        this.status = status;
        this.detectedAt = detectedAt;
    }

    public UUID getIncidentId() { return incidentId; }
    public UUID getTenantId() { return tenantId; }
    public IncidentType getIncidentType() { return incidentType; }
    public IncidentSeverity getSeverity() { return severity; }
    public String getSourceIp() { return sourceIp; }
    public UUID getAccountId() { return accountId; }
    public String getDescription() { return description; }
    public String getDetail() { return detail; }
    public IncidentStatus getStatus() { return status; }
    public Instant getResolvedAt() { return resolvedAt; }
    public UUID getResolvedBy() { return resolvedBy; }
    public Instant getDetectedAt() { return detectedAt; }

    public void resolve(UUID resolvedBy) {
        this.status = IncidentStatus.RESOLVED;
        this.resolvedAt = Instant.now();
        this.resolvedBy = resolvedBy;
    }
}
