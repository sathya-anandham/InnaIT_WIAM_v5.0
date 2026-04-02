package io.innait.wiam.adminconfigservice.controller;

import io.innait.wiam.adminconfigservice.dto.AddDomainRequest;
import io.innait.wiam.adminconfigservice.dto.TenantDomainResponse;
import io.innait.wiam.adminconfigservice.service.TenantService;
import io.innait.wiam.common.dto.ApiResponse;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/admin/tenants/{tenantId}/domains")
@PreAuthorize("hasRole('SUPER_ADMIN')")
public class TenantDomainController {

    private final TenantService tenantService;

    public TenantDomainController(TenantService tenantService) {
        this.tenantService = tenantService;
    }

    @PostMapping
    public ResponseEntity<ApiResponse<TenantDomainResponse>> addDomain(
            @PathVariable UUID tenantId,
            @Valid @RequestBody AddDomainRequest request) {
        return ResponseEntity.ok(ApiResponse.success(tenantService.addDomain(tenantId, request)));
    }

    @PostMapping("/{domainId}/verify")
    public ResponseEntity<ApiResponse<TenantDomainResponse>> verifyDomain(
            @PathVariable UUID tenantId,
            @PathVariable UUID domainId) {
        return ResponseEntity.ok(ApiResponse.success(tenantService.verifyDomain(tenantId, domainId)));
    }

    @DeleteMapping("/{domainId}")
    public ResponseEntity<ApiResponse<Void>> removeDomain(
            @PathVariable UUID tenantId,
            @PathVariable UUID domainId) {
        tenantService.removeDomain(tenantId, domainId);
        return ResponseEntity.ok(ApiResponse.success(null));
    }

    @PutMapping("/{domainId}/primary")
    public ResponseEntity<ApiResponse<TenantDomainResponse>> setPrimaryDomain(
            @PathVariable UUID tenantId,
            @PathVariable UUID domainId) {
        return ResponseEntity.ok(ApiResponse.success(tenantService.setPrimaryDomain(tenantId, domainId)));
    }

    @GetMapping
    public ResponseEntity<ApiResponse<List<TenantDomainResponse>>> listDomains(
            @PathVariable UUID tenantId) {
        return ResponseEntity.ok(ApiResponse.success(tenantService.listDomains(tenantId)));
    }
}
