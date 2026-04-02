package io.innait.wiam.adminconfigservice.controller;

import io.innait.wiam.adminconfigservice.dto.CreateOrgUnitRequest;
import io.innait.wiam.adminconfigservice.dto.OrgUnitResponse;
import io.innait.wiam.adminconfigservice.dto.UpdateOrgUnitRequest;
import io.innait.wiam.adminconfigservice.service.TenantService;
import io.innait.wiam.common.dto.ApiResponse;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/admin/tenants/{tenantId}/org-units")
@PreAuthorize("hasRole('SUPER_ADMIN')")
public class OrgUnitController {

    private final TenantService tenantService;

    public OrgUnitController(TenantService tenantService) {
        this.tenantService = tenantService;
    }

    @PostMapping
    public ResponseEntity<ApiResponse<OrgUnitResponse>> createOrgUnit(
            @PathVariable UUID tenantId,
            @Valid @RequestBody CreateOrgUnitRequest request) {
        return ResponseEntity.ok(ApiResponse.success(tenantService.createOrgUnit(tenantId, request)));
    }

    @PutMapping("/{orgUnitId}")
    public ResponseEntity<ApiResponse<OrgUnitResponse>> updateOrgUnit(
            @PathVariable UUID tenantId,
            @PathVariable UUID orgUnitId,
            @RequestBody UpdateOrgUnitRequest request) {
        return ResponseEntity.ok(ApiResponse.success(
                tenantService.updateOrgUnit(tenantId, orgUnitId, request)));
    }

    @GetMapping
    public ResponseEntity<ApiResponse<List<OrgUnitResponse>>> listOrgUnits(
            @PathVariable UUID tenantId) {
        return ResponseEntity.ok(ApiResponse.success(tenantService.listOrgUnits(tenantId)));
    }

    @GetMapping("/roots")
    public ResponseEntity<ApiResponse<List<OrgUnitResponse>>> listRootOrgUnits(
            @PathVariable UUID tenantId) {
        return ResponseEntity.ok(ApiResponse.success(tenantService.listRootOrgUnits(tenantId)));
    }

    @DeleteMapping("/{orgUnitId}")
    public ResponseEntity<ApiResponse<Void>> deleteOrgUnit(
            @PathVariable UUID tenantId,
            @PathVariable UUID orgUnitId) {
        tenantService.deleteOrgUnit(orgUnitId);
        return ResponseEntity.ok(ApiResponse.success(null));
    }
}
