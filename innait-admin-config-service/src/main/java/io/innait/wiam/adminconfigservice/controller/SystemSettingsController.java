package io.innait.wiam.adminconfigservice.controller;

import io.innait.wiam.adminconfigservice.dto.SetSettingRequest;
import io.innait.wiam.adminconfigservice.dto.SystemSettingResponse;
import io.innait.wiam.adminconfigservice.service.SystemSettingsService;
import io.innait.wiam.common.context.TenantContext;
import io.innait.wiam.common.dto.ApiResponse;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/admin/settings")
@PreAuthorize("hasAnyRole('SUPER_ADMIN', 'TENANT_ADMIN')")
public class SystemSettingsController {

    private final SystemSettingsService settingsService;

    public SystemSettingsController(SystemSettingsService settingsService) {
        this.settingsService = settingsService;
    }

    @GetMapping("/{key}")
    public ResponseEntity<ApiResponse<SystemSettingResponse>> getSetting(@PathVariable String key) {
        UUID tenantId = TenantContext.getTenantId();
        return ResponseEntity.ok(ApiResponse.success(settingsService.getSettingDetail(tenantId, key)));
    }

    @PutMapping("/{key}")
    public ResponseEntity<ApiResponse<SystemSettingResponse>> setSetting(
            @PathVariable String key,
            @Valid @RequestBody SetSettingRequest request) {
        UUID tenantId = TenantContext.requireTenantId();
        return ResponseEntity.ok(ApiResponse.success(
                settingsService.setSetting(tenantId, key, request.value())));
    }

    @GetMapping
    public ResponseEntity<ApiResponse<List<SystemSettingResponse>>> listSettings() {
        UUID tenantId = TenantContext.getTenantId();
        return ResponseEntity.ok(ApiResponse.success(settingsService.listSettings(tenantId)));
    }
}
