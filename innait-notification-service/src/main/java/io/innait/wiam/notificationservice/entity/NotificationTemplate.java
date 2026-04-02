package io.innait.wiam.notificationservice.entity;

import jakarta.persistence.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "NOTIFICATION_TEMPLATES", uniqueConstraints = {
        @UniqueConstraint(columnNames = {"TENANT_ID", "TEMPLATE_KEY", "CHANNEL"})
})
public class NotificationTemplate {

    @Id
    @Column(name = "TEMPLATE_ID", columnDefinition = "RAW(16)")
    private UUID templateId;

    @Column(name = "TENANT_ID", columnDefinition = "RAW(16)")
    private UUID tenantId;

    @Column(name = "TEMPLATE_KEY", nullable = false, length = 100)
    private String templateKey;

    @Enumerated(EnumType.STRING)
    @Column(name = "CHANNEL", nullable = false, length = 10)
    private NotificationChannel channel;

    @Column(name = "SUBJECT", length = 500)
    private String subject;

    @JdbcTypeCode(SqlTypes.CLOB)
    @Column(name = "BODY_TEMPLATE", nullable = false)
    private String bodyTemplate;

    @Column(name = "IS_DEFAULT", nullable = false)
    private boolean isDefault;

    @Column(name = "ACTIVE", nullable = false)
    private boolean active = true;

    @Column(name = "CREATED_AT")
    private Instant createdAt;

    @Column(name = "UPDATED_AT")
    private Instant updatedAt;

    protected NotificationTemplate() {
    }

    public NotificationTemplate(UUID templateId, UUID tenantId, String templateKey,
                                NotificationChannel channel, String subject,
                                String bodyTemplate, boolean isDefault) {
        this.templateId = templateId;
        this.tenantId = tenantId;
        this.templateKey = templateKey;
        this.channel = channel;
        this.subject = subject;
        this.bodyTemplate = bodyTemplate;
        this.isDefault = isDefault;
        this.createdAt = Instant.now();
        this.updatedAt = Instant.now();
    }

    public UUID getTemplateId() { return templateId; }
    public UUID getTenantId() { return tenantId; }
    public String getTemplateKey() { return templateKey; }
    public NotificationChannel getChannel() { return channel; }
    public String getSubject() { return subject; }
    public String getBodyTemplate() { return bodyTemplate; }
    public boolean isDefault() { return isDefault; }
    public boolean isActive() { return active; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }

    public void setSubject(String subject) { this.subject = subject; }
    public void setBodyTemplate(String bodyTemplate) { this.bodyTemplate = bodyTemplate; }
    public void setActive(boolean active) { this.active = active; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
}
