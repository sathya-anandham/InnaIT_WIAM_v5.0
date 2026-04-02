package io.innait.wiam.auditservice.entity;

import jakarta.persistence.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "AUDIT_EVENTS")
public class AuditEvent {

    @Id
    @Column(name = "AUDIT_EVENT_ID", columnDefinition = "RAW(16)")
    private UUID auditEventId;

    @Column(name = "TENANT_ID", nullable = false, columnDefinition = "RAW(16)")
    private UUID tenantId;

    @Column(name = "CORRELATION_ID", columnDefinition = "RAW(16)")
    private UUID correlationId;

    @Column(name = "EVENT_TYPE", length = 100)
    private String eventType;

    @Enumerated(EnumType.STRING)
    @Column(name = "EVENT_CATEGORY", length = 30)
    private EventCategory eventCategory;

    @Column(name = "ACTOR_ID", columnDefinition = "RAW(16)")
    private UUID actorId;

    @Column(name = "ACTOR_TYPE", length = 50)
    private String actorType;

    @Column(name = "ACTOR_IP", length = 45)
    private String actorIp;

    @Column(name = "SUBJECT_ID", columnDefinition = "RAW(16)")
    private UUID subjectId;

    @Column(name = "SUBJECT_TYPE", length = 50)
    private String subjectType;

    @Column(name = "RESOURCE_TYPE", length = 50)
    private String resourceType;

    @Column(name = "RESOURCE_ID", columnDefinition = "RAW(16)")
    private UUID resourceId;

    @Column(name = "ACTION", length = 50)
    private String action;

    @Enumerated(EnumType.STRING)
    @Column(name = "OUTCOME", length = 10)
    private AuditOutcome outcome;

    @JdbcTypeCode(SqlTypes.CLOB)
    @Column(name = "DETAIL")
    private String detail;

    @Column(name = "SERVICE_NAME", length = 100)
    private String serviceName;

    @Column(name = "EVENT_TIME")
    private Instant eventTime;

    // ---- Constructors ----

    protected AuditEvent() {
    }

    public AuditEvent(UUID auditEventId, UUID tenantId, UUID correlationId,
                      String eventType, EventCategory eventCategory,
                      UUID actorId, String actorType, String actorIp,
                      UUID subjectId, String subjectType,
                      String resourceType, UUID resourceId,
                      String action, AuditOutcome outcome, String detail,
                      String serviceName, Instant eventTime) {
        this.auditEventId = auditEventId;
        this.tenantId = tenantId;
        this.correlationId = correlationId;
        this.eventType = eventType;
        this.eventCategory = eventCategory;
        this.actorId = actorId;
        this.actorType = actorType;
        this.actorIp = actorIp;
        this.subjectId = subjectId;
        this.subjectType = subjectType;
        this.resourceType = resourceType;
        this.resourceId = resourceId;
        this.action = action;
        this.outcome = outcome;
        this.detail = detail;
        this.serviceName = serviceName;
        this.eventTime = eventTime;
    }

    // ---- Getters ----

    public UUID getAuditEventId() { return auditEventId; }
    public UUID getTenantId() { return tenantId; }
    public UUID getCorrelationId() { return correlationId; }
    public String getEventType() { return eventType; }
    public EventCategory getEventCategory() { return eventCategory; }
    public UUID getActorId() { return actorId; }
    public String getActorType() { return actorType; }
    public String getActorIp() { return actorIp; }
    public UUID getSubjectId() { return subjectId; }
    public String getSubjectType() { return subjectType; }
    public String getResourceType() { return resourceType; }
    public UUID getResourceId() { return resourceId; }
    public String getAction() { return action; }
    public AuditOutcome getOutcome() { return outcome; }
    public String getDetail() { return detail; }
    public String getServiceName() { return serviceName; }
    public Instant getEventTime() { return eventTime; }
}
