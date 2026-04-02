package io.innait.wiam.notificationservice.controller;

import io.innait.wiam.common.context.TenantContext;
import io.innait.wiam.common.dto.ApiResponse;
import io.innait.wiam.notificationservice.dto.NotificationTemplateResponse;
import io.innait.wiam.notificationservice.dto.NotificationTemplateUpdateRequest;
import io.innait.wiam.notificationservice.dto.TestNotificationRequest;
import io.innait.wiam.notificationservice.entity.NotificationChannel;
import io.innait.wiam.notificationservice.entity.PushProvider;
import io.innait.wiam.notificationservice.service.NotificationService;
import io.innait.wiam.notificationservice.service.NotificationTemplateService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/notifications")
public class NotificationController {

    private final NotificationTemplateService templateService;
    private final NotificationService notificationService;

    public NotificationController(NotificationTemplateService templateService,
                                  NotificationService notificationService) {
        this.templateService = templateService;
        this.notificationService = notificationService;
    }

    @GetMapping("/templates")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN', 'TENANT_ADMIN')")
    public ResponseEntity<ApiResponse<List<NotificationTemplateResponse>>> listTemplates() {
        return ResponseEntity.ok(ApiResponse.success(templateService.listTemplates()));
    }

    @PutMapping("/templates/{templateKey}")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN', 'TENANT_ADMIN')")
    public ResponseEntity<ApiResponse<NotificationTemplateResponse>> updateTemplate(
            @PathVariable String templateKey,
            @Valid @RequestBody NotificationTemplateUpdateRequest request) {
        return ResponseEntity.ok(ApiResponse.success(templateService.updateTemplate(templateKey, request)));
    }

    @PostMapping("/test")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN', 'TENANT_ADMIN')")
    public ResponseEntity<ApiResponse<String>> sendTestNotification(
            @Valid @RequestBody TestNotificationRequest request) {
        var tenantId = TenantContext.requireTenantId();
        Map<String, String> vars = request.variables() != null ? request.variables() : Map.of();

        switch (request.channel()) {
            case EMAIL -> notificationService.sendEmail(tenantId, request.recipient(),
                    request.templateKey(), vars);
            case SMS -> notificationService.sendSms(tenantId, request.recipient(),
                    request.templateKey(), vars);
            case PUSH -> notificationService.sendPush(tenantId, request.recipient(),
                    PushProvider.FCM, "Test", "Test notification", vars);
        }

        return ResponseEntity.ok(ApiResponse.success("Notification sent successfully"));
    }
}
