package io.innait.wiam.adminconfigservice.controller;

import io.innait.wiam.adminconfigservice.dto.CreateTenantRequest;
import io.innait.wiam.adminconfigservice.dto.TenantResponse;
import io.innait.wiam.adminconfigservice.dto.UpdateTenantRequest;
import io.innait.wiam.adminconfigservice.service.TenantService;
import io.innait.wiam.common.dto.ApiResponse;
import jakarta.validation.Valid;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/admin/tenants")
@PreAuthorize("hasRole('SUPER_ADMIN')")
public class TenantController {

    private final TenantService tenantService;

    public TenantController(TenantService tenantService) {
        this.tenantService = tenantService;
    }

    @PostMapping
    public ResponseEntity<ApiResponse<TenantResponse>> createTenant(
            @Valid @RequestBody CreateTenantRequest request) {
        return ResponseEntity.ok(ApiResponse.success(tenantService.createTenant(request)));
    }

    @PutMapping("/{tenantId}")
    public ResponseEntity<ApiResponse<TenantResponse>> updateTenant(
            @PathVariable UUID tenantId,
            @RequestBody UpdateTenantRequest request) {
        return ResponseEntity.ok(ApiResponse.success(tenantService.updateTenant(tenantId, request)));
    }

    @GetMapping("/{tenantId}")
    public ResponseEntity<ApiResponse<TenantResponse>> getTenant(@PathVariable UUID tenantId) {
        return ResponseEntity.ok(ApiResponse.success(tenantService.getTenant(tenantId)));
    }

    @GetMapping
    public ResponseEntity<ApiResponse<Page<TenantResponse>>> listTenants(Pageable pageable) {
        return ResponseEntity.ok(ApiResponse.success(tenantService.listTenants(pageable)));
    }
}
