package io.innait.wiam.notificationservice.service;

import io.innait.wiam.common.context.TenantContext;
import io.innait.wiam.notificationservice.dto.NotificationTemplateResponse;
import io.innait.wiam.notificationservice.dto.NotificationTemplateUpdateRequest;
import io.innait.wiam.notificationservice.entity.NotificationChannel;
import io.innait.wiam.notificationservice.entity.NotificationTemplate;
import io.innait.wiam.notificationservice.repository.NotificationTemplateRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
public class NotificationTemplateService {

    private static final Logger log = LoggerFactory.getLogger(NotificationTemplateService.class);
    private static final Pattern VARIABLE_PATTERN = Pattern.compile("\\{\\{(\\w+)}}");

    private final NotificationTemplateRepository templateRepository;

    public NotificationTemplateService(NotificationTemplateRepository templateRepository) {
        this.templateRepository = templateRepository;
    }

    /**
     * Resolve a template by key and channel for the current tenant.
     * Tenant-specific template overrides the default.
     */
    @Transactional(readOnly = true)
    public NotificationTemplate resolveTemplate(String templateKey, NotificationChannel channel) {
        UUID tenantId = TenantContext.getTenantId();

        // 1. Try tenant-specific override
        if (tenantId != null) {
            var tenantTemplate = templateRepository.findTenantTemplate(tenantId, templateKey, channel);
            if (tenantTemplate.isPresent()) {
                return tenantTemplate.get();
            }
        }

        // 2. Fall back to default
        return templateRepository.findDefaultTemplate(templateKey, channel)
                .orElseThrow(() -> new IllegalArgumentException(
                        "No template found for key: " + templateKey + ", channel: " + channel));
    }

    /**
     * Substitute {{variable}} placeholders in a template body.
     */
    public String render(String template, Map<String, String> variables) {
        if (template == null || variables == null) return template;

        Matcher matcher = VARIABLE_PATTERN.matcher(template);
        StringBuilder result = new StringBuilder();
        while (matcher.find()) {
            String varName = matcher.group(1);
            String replacement = variables.getOrDefault(varName, "");
            matcher.appendReplacement(result, Matcher.quoteReplacement(replacement));
        }
        matcher.appendTail(result);
        return result.toString();
    }

    /**
     * Render subject line with variable substitution.
     */
    public String renderSubject(NotificationTemplate template, Map<String, String> variables) {
        return render(template.getSubject(), variables);
    }

    /**
     * Render body with variable substitution.
     */
    public String renderBody(NotificationTemplate template, Map<String, String> variables) {
        return render(template.getBodyTemplate(), variables);
    }

    // ---- Admin CRUD ----

    @Transactional(readOnly = true)
    public List<NotificationTemplateResponse> listTemplates() {
        UUID tenantId = TenantContext.getTenantId();
        List<NotificationTemplate> templates;
        if (tenantId != null) {
            templates = templateRepository.findByTenantIdAndActiveTrue(tenantId);
            // Add defaults not overridden
            List<String> overriddenKeys = templates.stream()
                    .map(t -> t.getTemplateKey() + ":" + t.getChannel())
                    .toList();
            List<NotificationTemplate> defaults = templateRepository.findByIsDefaultTrueAndActiveTrue()
                    .stream()
                    .filter(d -> !overriddenKeys.contains(d.getTemplateKey() + ":" + d.getChannel()))
                    .toList();
            templates.addAll(defaults);
        } else {
            templates = templateRepository.findByIsDefaultTrueAndActiveTrue();
        }
        return templates.stream().map(this::toResponse).toList();
    }

    @Transactional
    public NotificationTemplateResponse updateTemplate(String templateKey,
                                                        NotificationTemplateUpdateRequest request) {
        UUID tenantId = TenantContext.requireTenantId();

        var existing = templateRepository.findTenantTemplate(tenantId, templateKey, request.channel());

        NotificationTemplate template;
        if (existing.isPresent()) {
            template = existing.get();
            if (request.subject() != null) template.setSubject(request.subject());
            if (request.bodyTemplate() != null) template.setBodyTemplate(request.bodyTemplate());
            template.setUpdatedAt(Instant.now());
        } else {
            // Create tenant override from default
            var defaultTemplate = templateRepository.findDefaultTemplate(templateKey, request.channel())
                    .orElseThrow(() -> new IllegalArgumentException(
                            "No default template for key: " + templateKey));
            template = new NotificationTemplate(
                    UUID.randomUUID(), tenantId, templateKey, request.channel(),
                    request.subject() != null ? request.subject() : defaultTemplate.getSubject(),
                    request.bodyTemplate() != null ? request.bodyTemplate() : defaultTemplate.getBodyTemplate(),
                    false);
        }

        templateRepository.save(template);
        log.info("Updated template [{}] for tenant [{}]", templateKey, tenantId);
        return toResponse(template);
    }

    private NotificationTemplateResponse toResponse(NotificationTemplate t) {
        return new NotificationTemplateResponse(
                t.getTemplateId(), t.getTenantId(), t.getTemplateKey(),
                t.getChannel(), t.getSubject(), t.getBodyTemplate(),
                t.isDefault(), t.isActive(), t.getCreatedAt(), t.getUpdatedAt());
    }
}
