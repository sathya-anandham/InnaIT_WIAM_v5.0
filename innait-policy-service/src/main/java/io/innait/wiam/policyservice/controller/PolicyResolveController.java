package io.innait.wiam.policyservice.controller;

import io.innait.wiam.common.dto.ApiResponse;
import io.innait.wiam.policyservice.dto.*;
import io.innait.wiam.policyservice.service.PolicyAdminService;
import io.innait.wiam.policyservice.service.PolicyService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/policies/resolve")
public class PolicyResolveController {

    private final PolicyService policyService;
    private final PolicyAdminService policyAdminService;

    public PolicyResolveController(PolicyService policyService, PolicyAdminService policyAdminService) {
        this.policyService = policyService;
        this.policyAdminService = policyAdminService;
    }

    @GetMapping("/password")
    public ResponseEntity<ApiResponse<PasswordPolicyResponse>> resolvePasswordPolicy(
            @RequestParam UUID accountId,
            @RequestParam(required = false) List<UUID> groupIds,
            @RequestParam(required = false) List<UUID> roleIds) {
        PasswordPolicyResponse response = policyService.resolvePasswordPolicy(accountId, groupIds, roleIds);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @GetMapping("/mfa")
    public ResponseEntity<ApiResponse<MfaPolicyResponse>> resolveMfaPolicy(
            @RequestParam UUID accountId,
            @RequestParam(required = false) List<UUID> groupIds,
            @RequestParam(required = false) List<UUID> roleIds) {
        MfaPolicyResponse response = policyService.resolveMfaPolicy(accountId, groupIds, roleIds);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @GetMapping("/auth")
    public ResponseEntity<ApiResponse<AuthPolicyResult>> resolveAuthPolicy(
            @RequestParam UUID accountId,
            @RequestParam(required = false) List<UUID> groupIds,
            @RequestParam(required = false) List<UUID> roleIds,
            @RequestParam(required = false) Map<String, Object> context) {
        AuthPolicyResult response = policyService.resolveAuthPolicy(accountId, groupIds, roleIds, context);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @PostMapping("/simulate")
    public ResponseEntity<ApiResponse<PolicySimulateResponse>> simulate(
            @Valid @RequestBody PolicySimulateRequest request) {
        PolicySimulateResponse response = policyAdminService.simulate(request);
        return ResponseEntity.ok(ApiResponse.success(response));
    }
}
