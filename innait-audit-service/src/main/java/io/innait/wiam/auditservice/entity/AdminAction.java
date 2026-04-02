package io.innait.wiam.auditservice.entity;

import jakarta.persistence.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "ADMIN_ACTIONS")
public class AdminAction {

    @Id
    @Column(name = "ADMIN_ACTION_ID", columnDefinition = "RAW(16)")
    private UUID adminActionId;

    @Column(name = "TENANT_ID", nullable = false, columnDefinition = "RAW(16)")
    private UUID tenantId;

    @Column(name = "ADMIN_ID", columnDefinition = "RAW(16)")
    private UUID adminId;

    @Column(name = "ACTION_TYPE", length = 50)
    private String actionType;

    @Column(name = "TARGET_TYPE", length = 50)
    private String targetType;

    @Column(name = "TARGET_ID", columnDefinition = "RAW(16)")
    private UUID targetId;

    @JdbcTypeCode(SqlTypes.CLOB)
    @Column(name = "BEFORE_STATE")
    private String beforeState;

    @JdbcTypeCode(SqlTypes.CLOB)
    @Column(name = "AFTER_STATE")
    private String afterState;

    @Column(name = "JUSTIFICATION", length = 1000)
    private String justification;

    @Column(name = "ACTION_TIME")
    private Instant actionTime;

    protected AdminAction() {
    }

    public AdminAction(UUID adminActionId, UUID tenantId, UUID adminId,
                       String actionType, String targetType, UUID targetId,
                       String beforeState, String afterState,
                       String justification, Instant actionTime) {
        this.adminActionId = adminActionId;
        this.tenantId = tenantId;
        this.adminId = adminId;
        this.actionType = actionType;
        this.targetType = targetType;
        this.targetId = targetId;
        this.beforeState = beforeState;
        this.afterState = afterState;
        this.justification = justification;
        this.actionTime = actionTime;
    }

    public UUID getAdminActionId() { return adminActionId; }
    public UUID getTenantId() { return tenantId; }
    public UUID getAdminId() { return adminId; }
    public String getActionType() { return actionType; }
    public String getTargetType() { return targetType; }
    public UUID getTargetId() { return targetId; }
    public String getBeforeState() { return beforeState; }
    public String getAfterState() { return afterState; }
    public String getJustification() { return justification; }
    public Instant getActionTime() { return actionTime; }
}
