package io.innait.wiam.policyservice.controller;

import io.innait.wiam.common.dto.ApiResponse;
import io.innait.wiam.policyservice.dto.*;
import io.innait.wiam.policyservice.service.PolicyAdminService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/policies")
public class PolicyAdminController {

    private final PolicyAdminService adminService;

    public PolicyAdminController(PolicyAdminService adminService) {
        this.adminService = adminService;
    }

    // ---- Password Policies ----

    @PostMapping("/password")
    public ResponseEntity<ApiResponse<PasswordPolicyResponse>> createPasswordPolicy(
            @Valid @RequestBody PasswordPolicyCreateRequest request) {
        return ResponseEntity.ok(ApiResponse.success(adminService.createPasswordPolicy(request)));
    }

    @PutMapping("/password/{policyId}")
    public ResponseEntity<ApiResponse<PasswordPolicyResponse>> updatePasswordPolicy(
            @PathVariable UUID policyId, @Valid @RequestBody PasswordPolicyCreateRequest request) {
        return ResponseEntity.ok(ApiResponse.success(adminService.updatePasswordPolicy(policyId, request)));
    }

    @GetMapping("/password/{policyId}")
    public ResponseEntity<ApiResponse<PasswordPolicyResponse>> getPasswordPolicy(@PathVariable UUID policyId) {
        return ResponseEntity.ok(ApiResponse.success(adminService.getPasswordPolicy(policyId)));
    }

    @GetMapping("/password")
    public ResponseEntity<ApiResponse<List<PasswordPolicyResponse>>> listPasswordPolicies() {
        return ResponseEntity.ok(ApiResponse.success(adminService.listPasswordPolicies()));
    }

    @DeleteMapping("/password/{policyId}")
    public ResponseEntity<ApiResponse<Void>> deletePasswordPolicy(@PathVariable UUID policyId) {
        adminService.deletePasswordPolicy(policyId);
        return ResponseEntity.ok(ApiResponse.success(null));
    }

    // ---- MFA Policies ----

    @PostMapping("/mfa")
    public ResponseEntity<ApiResponse<MfaPolicyResponse>> createMfaPolicy(
            @Valid @RequestBody MfaPolicyCreateRequest request) {
        return ResponseEntity.ok(ApiResponse.success(adminService.createMfaPolicy(request)));
    }

    @PutMapping("/mfa/{policyId}")
    public ResponseEntity<ApiResponse<MfaPolicyResponse>> updateMfaPolicy(
            @PathVariable UUID policyId, @Valid @RequestBody MfaPolicyCreateRequest request) {
        return ResponseEntity.ok(ApiResponse.success(adminService.updateMfaPolicy(policyId, request)));
    }

    @GetMapping("/mfa/{policyId}")
    public ResponseEntity<ApiResponse<MfaPolicyResponse>> getMfaPolicy(@PathVariable UUID policyId) {
        return ResponseEntity.ok(ApiResponse.success(adminService.getMfaPolicy(policyId)));
    }

    @GetMapping("/mfa")
    public ResponseEntity<ApiResponse<List<MfaPolicyResponse>>> listMfaPolicies() {
        return ResponseEntity.ok(ApiResponse.success(adminService.listMfaPolicies()));
    }

    @DeleteMapping("/mfa/{policyId}")
    public ResponseEntity<ApiResponse<Void>> deleteMfaPolicy(@PathVariable UUID policyId) {
        adminService.deleteMfaPolicy(policyId);
        return ResponseEntity.ok(ApiResponse.success(null));
    }

    // ---- Auth Policies ----

    @PostMapping("/auth")
    public ResponseEntity<ApiResponse<AuthPolicyResponse>> createAuthPolicy(
            @Valid @RequestBody AuthPolicyCreateRequest request) {
        return ResponseEntity.ok(ApiResponse.success(adminService.createAuthPolicy(request)));
    }

    @PutMapping("/auth/{policyId}")
    public ResponseEntity<ApiResponse<AuthPolicyResponse>> updateAuthPolicy(
            @PathVariable UUID policyId, @Valid @RequestBody AuthPolicyCreateRequest request) {
        return ResponseEntity.ok(ApiResponse.success(adminService.updateAuthPolicy(policyId, request)));
    }

    @GetMapping("/auth/{policyId}")
    public ResponseEntity<ApiResponse<AuthPolicyResponse>> getAuthPolicy(@PathVariable UUID policyId) {
        return ResponseEntity.ok(ApiResponse.success(adminService.getAuthPolicy(policyId)));
    }

    @GetMapping("/auth")
    public ResponseEntity<ApiResponse<List<AuthPolicyResponse>>> listAuthPolicies() {
        return ResponseEntity.ok(ApiResponse.success(adminService.listAuthPolicies()));
    }

    @DeleteMapping("/auth/{policyId}")
    public ResponseEntity<ApiResponse<Void>> deleteAuthPolicy(@PathVariable UUID policyId) {
        adminService.deleteAuthPolicy(policyId);
        return ResponseEntity.ok(ApiResponse.success(null));
    }

    // ---- Policy Bindings ----

    @PostMapping("/bindings")
    public ResponseEntity<ApiResponse<PolicyBindingResponse>> createBinding(
            @Valid @RequestBody PolicyBindingRequest request) {
        return ResponseEntity.ok(ApiResponse.success(adminService.createBinding(request)));
    }

    @DeleteMapping("/bindings/{bindingId}")
    public ResponseEntity<ApiResponse<Void>> deleteBinding(@PathVariable UUID bindingId) {
        adminService.deleteBinding(bindingId);
        return ResponseEntity.ok(ApiResponse.success(null));
    }

    @GetMapping("/bindings")
    public ResponseEntity<ApiResponse<List<PolicyBindingResponse>>> listBindings() {
        return ResponseEntity.ok(ApiResponse.success(adminService.listBindings()));
    }
}
