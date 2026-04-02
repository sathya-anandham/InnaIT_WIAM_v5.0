package io.innait.wiam.adminconfigservice.controller;

import io.innait.wiam.adminconfigservice.dto.*;
import io.innait.wiam.adminconfigservice.service.ConnectorService;
import io.innait.wiam.common.context.TenantContext;
import io.innait.wiam.common.dto.ApiResponse;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/admin/connectors")
@PreAuthorize("hasAnyRole('SUPER_ADMIN', 'TENANT_ADMIN')")
public class ConnectorController {

    private final ConnectorService connectorService;

    public ConnectorController(ConnectorService connectorService) {
        this.connectorService = connectorService;
    }

    @PostMapping
    public ResponseEntity<ApiResponse<ConnectorResponse>> createConnector(
            @Valid @RequestBody CreateConnectorRequest request) {
        UUID tenantId = TenantContext.requireTenantId();
        return ResponseEntity.ok(ApiResponse.success(
                connectorService.createConnector(tenantId, request)));
    }

    @PutMapping("/{connectorId}")
    public ResponseEntity<ApiResponse<ConnectorResponse>> updateConnector(
            @PathVariable UUID connectorId,
            @RequestBody UpdateConnectorRequest request) {
        UUID tenantId = TenantContext.requireTenantId();
        return ResponseEntity.ok(ApiResponse.success(
                connectorService.updateConnector(tenantId, connectorId, request)));
    }

    @GetMapping("/{connectorId}")
    public ResponseEntity<ApiResponse<ConnectorResponse>> getConnector(
            @PathVariable UUID connectorId) {
        return ResponseEntity.ok(ApiResponse.success(connectorService.getConnector(connectorId)));
    }

    @GetMapping
    public ResponseEntity<ApiResponse<List<ConnectorResponse>>> listConnectors() {
        UUID tenantId = TenantContext.requireTenantId();
        return ResponseEntity.ok(ApiResponse.success(connectorService.listConnectors(tenantId)));
    }

    @DeleteMapping("/{connectorId}")
    public ResponseEntity<ApiResponse<Void>> deleteConnector(@PathVariable UUID connectorId) {
        connectorService.deleteConnector(connectorId);
        return ResponseEntity.ok(ApiResponse.success(null));
    }

    @PostMapping("/{connectorId}/test")
    public ResponseEntity<ApiResponse<ConnectorTestResult>> testConnector(
            @PathVariable UUID connectorId) {
        return ResponseEntity.ok(ApiResponse.success(connectorService.testConnector(connectorId)));
    }
}
