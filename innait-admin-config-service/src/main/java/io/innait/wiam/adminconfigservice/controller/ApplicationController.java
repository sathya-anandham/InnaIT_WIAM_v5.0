package io.innait.wiam.adminconfigservice.controller;

import io.innait.wiam.adminconfigservice.dto.ApplicationResponse;
import io.innait.wiam.adminconfigservice.dto.CreateApplicationRequest;
import io.innait.wiam.adminconfigservice.dto.UpdateApplicationRequest;
import io.innait.wiam.adminconfigservice.service.ApplicationService;
import io.innait.wiam.common.context.TenantContext;
import io.innait.wiam.common.dto.ApiResponse;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/admin/applications")
@PreAuthorize("hasAnyRole('SUPER_ADMIN', 'TENANT_ADMIN')")
public class ApplicationController {

    private final ApplicationService applicationService;

    public ApplicationController(ApplicationService applicationService) {
        this.applicationService = applicationService;
    }

    @PostMapping
    public ResponseEntity<ApiResponse<ApplicationResponse>> createApplication(
            @Valid @RequestBody CreateApplicationRequest request) {
        UUID tenantId = TenantContext.requireTenantId();
        return ResponseEntity.ok(ApiResponse.success(
                applicationService.createApplication(tenantId, request)));
    }

    @PutMapping("/{appId}")
    public ResponseEntity<ApiResponse<ApplicationResponse>> updateApplication(
            @PathVariable UUID appId,
            @RequestBody UpdateApplicationRequest request) {
        UUID tenantId = TenantContext.requireTenantId();
        return ResponseEntity.ok(ApiResponse.success(
                applicationService.updateApplication(tenantId, appId, request)));
    }

    @GetMapping("/{appId}")
    public ResponseEntity<ApiResponse<ApplicationResponse>> getApplication(
            @PathVariable UUID appId) {
        return ResponseEntity.ok(ApiResponse.success(applicationService.getApplication(appId)));
    }

    @GetMapping
    public ResponseEntity<ApiResponse<List<ApplicationResponse>>> listApplications() {
        UUID tenantId = TenantContext.requireTenantId();
        return ResponseEntity.ok(ApiResponse.success(applicationService.listApplications(tenantId)));
    }

    @DeleteMapping("/{appId}")
    public ResponseEntity<ApiResponse<Void>> deleteApplication(@PathVariable UUID appId) {
        applicationService.deleteApplication(appId);
        return ResponseEntity.ok(ApiResponse.success(null));
    }
}
