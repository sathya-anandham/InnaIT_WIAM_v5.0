package io.innait.wiam.identityservice.controller;

import io.innait.wiam.common.constant.AccountStatus;
import io.innait.wiam.common.dto.ApiResponse;
import io.innait.wiam.identityservice.dto.*;
import io.innait.wiam.identityservice.service.BulkOperationService;
import io.innait.wiam.identityservice.service.RoleService;
import io.innait.wiam.identityservice.service.UserService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/identity/accounts")
public class AccountController {

    private final UserService userService;
    private final RoleService roleService;
    private final BulkOperationService bulkOperationService;

    public AccountController(UserService userService, RoleService roleService,
                             BulkOperationService bulkOperationService) {
        this.userService = userService;
        this.roleService = roleService;
        this.bulkOperationService = bulkOperationService;
    }

    @PatchMapping("/{accountId}/status")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN', 'TENANT_ADMIN', 'USER_ADMIN')")
    public ResponseEntity<ApiResponse<Void>> changeAccountStatus(
            @PathVariable UUID accountId,
            @Valid @RequestBody AccountStatusChangeRequest request) {
        switch (request.status()) {
            case ACTIVE -> userService.activateAccount(accountId);
            case SUSPENDED -> userService.suspendAccount(accountId, request.reason());
            case LOCKED -> userService.lockAccount(accountId);
            case DEPROVISIONED -> userService.terminateAccount(accountId, request.reason());
            case INACTIVE -> userService.disableAccount(accountId);
            default -> throw new IllegalArgumentException("Unsupported target status: " + request.status());
        }
        return ResponseEntity.ok(ApiResponse.success(null));
    }

    @PostMapping("/{accountId}/unlock")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN', 'TENANT_ADMIN', 'USER_ADMIN', 'HELPDESK')")
    public ResponseEntity<ApiResponse<Void>> unlockAccount(@PathVariable UUID accountId) {
        userService.unlockAccount(accountId);
        return ResponseEntity.ok(ApiResponse.success(null));
    }

    @GetMapping("/{accountId}/roles")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<List<RoleAssignmentResponse>>> getAccountRoles(
            @PathVariable UUID accountId) {
        return ResponseEntity.ok(ApiResponse.success(roleService.getAccountRoles(accountId)));
    }

    @PostMapping("/{accountId}/roles")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN', 'TENANT_ADMIN', 'USER_ADMIN')")
    public ResponseEntity<ApiResponse<RoleAssignmentResponse>> assignRole(
            @PathVariable UUID accountId,
            @Valid @RequestBody RoleAssignmentRequest request) {
        return ResponseEntity.ok(ApiResponse.success(roleService.assignRoleToAccount(accountId, request)));
    }

    @DeleteMapping("/{accountId}/roles/{roleId}")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN', 'TENANT_ADMIN', 'USER_ADMIN')")
    public ResponseEntity<ApiResponse<Void>> removeRole(
            @PathVariable UUID accountId,
            @PathVariable UUID roleId,
            @RequestBody(required = false) RoleRemovalRequest request) {
        roleService.removeRoleFromAccount(accountId, roleId,
                request != null ? request : new RoleRemovalRequest(null, null, null));
        return ResponseEntity.ok(ApiResponse.success(null));
    }

    @GetMapping("/{accountId}/entitlements")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<List<EffectiveEntitlementResponse>>> getEffectiveEntitlements(
            @PathVariable UUID accountId) {
        return ResponseEntity.ok(ApiResponse.success(roleService.getEffectiveEntitlements(accountId)));
    }

    @PostMapping("/bulk/{action}")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN', 'TENANT_ADMIN')")
    public ResponseEntity<ApiResponse<BulkOperationResponse>> bulkStatusChange(
            @PathVariable String action,
            @Valid @RequestBody BulkStatusChangeRequest request) {
        AccountStatus targetStatus = resolveActionStatus(action, request.targetStatus());
        UUID jobId = bulkOperationService.startBulkStatusChange(request.accountIds(), targetStatus);
        return ResponseEntity.accepted().body(ApiResponse.success(bulkOperationService.getJobStatus(jobId)));
    }

    private AccountStatus resolveActionStatus(String action, AccountStatus fallback) {
        return switch (action.toLowerCase()) {
            case "activate" -> AccountStatus.ACTIVE;
            case "suspend" -> AccountStatus.SUSPENDED;
            case "lock" -> AccountStatus.LOCKED;
            case "disable" -> AccountStatus.INACTIVE;
            case "terminate" -> AccountStatus.DEPROVISIONED;
            default -> fallback;
        };
    }
}
