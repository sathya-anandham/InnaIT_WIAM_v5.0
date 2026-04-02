package io.innait.wiam.adminconfigservice.controller;

import io.innait.wiam.adminconfigservice.dto.FeatureFlagResponse;
import io.innait.wiam.adminconfigservice.dto.SetFeatureFlagRequest;
import io.innait.wiam.adminconfigservice.service.FeatureFlagService;
import io.innait.wiam.common.context.TenantContext;
import io.innait.wiam.common.dto.ApiResponse;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/admin/features")
@PreAuthorize("hasAnyRole('SUPER_ADMIN', 'TENANT_ADMIN')")
public class FeatureFlagController {

    private final FeatureFlagService featureFlagService;

    public FeatureFlagController(FeatureFlagService featureFlagService) {
        this.featureFlagService = featureFlagService;
    }

    @GetMapping("/{flagKey}")
    public ResponseEntity<ApiResponse<Boolean>> getFlag(@PathVariable String flagKey) {
        UUID tenantId = TenantContext.requireTenantId();
        return ResponseEntity.ok(ApiResponse.success(featureFlagService.getFlag(tenantId, flagKey)));
    }

    @PutMapping("/{flagKey}")
    public ResponseEntity<ApiResponse<FeatureFlagResponse>> setFlag(
            @PathVariable String flagKey,
            @Valid @RequestBody SetFeatureFlagRequest request) {
        UUID tenantId = TenantContext.requireTenantId();
        return ResponseEntity.ok(ApiResponse.success(
                featureFlagService.setFlag(tenantId, flagKey, request.value())));
    }

    @GetMapping
    public ResponseEntity<ApiResponse<Map<String, Boolean>>> listFlags() {
        UUID tenantId = TenantContext.requireTenantId();
        return ResponseEntity.ok(ApiResponse.success(featureFlagService.listFlags(tenantId)));
    }

    @GetMapping("/details")
    public ResponseEntity<ApiResponse<List<FeatureFlagResponse>>> listFlagDetails() {
        UUID tenantId = TenantContext.requireTenantId();
        return ResponseEntity.ok(ApiResponse.success(featureFlagService.listFlagDetails(tenantId)));
    }
}
