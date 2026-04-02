package io.innait.wiam.identityservice.controller;

import io.innait.wiam.common.dto.ApiResponse;
import io.innait.wiam.identityservice.dto.*;
import io.innait.wiam.identityservice.service.RoleService;
import jakarta.validation.Valid;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/identity/roles")
public class RoleController {

    private final RoleService roleService;

    public RoleController(RoleService roleService) {
        this.roleService = roleService;
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('SUPER_ADMIN', 'TENANT_ADMIN')")
    public ResponseEntity<ApiResponse<RoleResponse>> createRole(@Valid @RequestBody CreateRoleRequest request) {
        RoleResponse response = roleService.createRole(
                request.roleCode(), request.roleName(), request.description(),
                request.roleType(), request.system());
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @GetMapping("/{roleId}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<RoleResponse>> getRoleById(@PathVariable UUID roleId) {
        return ResponseEntity.ok(ApiResponse.success(roleService.getRoleById(roleId)));
    }

    @GetMapping
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<Page<RoleResponse>>> listRoles(Pageable pageable) {
        return ResponseEntity.ok(ApiResponse.success(roleService.listRoles(pageable)));
    }

    @PatchMapping("/{roleId}")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN', 'TENANT_ADMIN')")
    public ResponseEntity<ApiResponse<RoleResponse>> updateRole(
            @PathVariable UUID roleId, @Valid @RequestBody UpdateRoleRequest request) {
        return ResponseEntity.ok(ApiResponse.success(
                roleService.updateRole(roleId, request.roleName(), request.description())));
    }

    @DeleteMapping("/{roleId}")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN', 'TENANT_ADMIN')")
    public ResponseEntity<ApiResponse<Void>> deactivateRole(@PathVariable UUID roleId) {
        roleService.deactivateRole(roleId);
        return ResponseEntity.ok(ApiResponse.success(null));
    }

    @PostMapping("/{roleId}/bulk-assign")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN', 'TENANT_ADMIN')")
    public ResponseEntity<ApiResponse<Void>> bulkAssignRole(
            @PathVariable UUID roleId, @Valid @RequestBody BulkRoleRequest request) {
        roleService.bulkAssignRole(roleId, request.accountIds());
        return ResponseEntity.ok(ApiResponse.success(null));
    }

    @PostMapping("/{roleId}/bulk-remove")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN', 'TENANT_ADMIN')")
    public ResponseEntity<ApiResponse<Void>> bulkRemoveRole(
            @PathVariable UUID roleId, @Valid @RequestBody BulkRoleRequest request) {
        roleService.bulkRemoveRole(roleId, request.accountIds());
        return ResponseEntity.ok(ApiResponse.success(null));
    }
}
