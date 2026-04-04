package io.innait.wiam.adminbff.controller;

import io.innait.wiam.adminbff.client.DeviceServiceClient;
import io.innait.wiam.common.dto.ApiResponse;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Admin BFF controller for Device Inventory and Device Assignment management.
 * Proxies to credential-service device APIs with admin-level authorization.
 *
 * Admin UI Modules served:
 * A. Device Inventory Module — list, import, filter, detail, stock/assigned/active/returned views
 * B. Device Assignment Module — assign, view, reassign, revoke, return, delivery acknowledgement
 * C. User/Account Detail integration — assigned devices tab, enrollment/activation/bootstrap state
 * D. End-user self-service — see SelfServiceController for user-facing device/enrollment endpoints
 */
@RestController
@RequestMapping("/api/v1/bff/devices")
public class DeviceManagementController {

    private final DeviceServiceClient deviceClient;

    public DeviceManagementController(DeviceServiceClient deviceClient) {
        this.deviceClient = deviceClient;
    }

    // ==== A. Device Inventory Module ====

    @PostMapping
    @PreAuthorize("hasAnyRole('SUPER_ADMIN', 'TENANT_ADMIN', 'USER_ADMIN')")
    public ResponseEntity<ApiResponse<Map<String, Object>>> registerDevice(
            @RequestBody Map<String, Object> request) {
        return ResponseEntity.ok(ApiResponse.success(deviceClient.registerDevice(request)));
    }

    @PostMapping("/bulk-import")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN', 'TENANT_ADMIN')")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> bulkImport(
            @RequestBody Map<String, Object> request) {
        return ResponseEntity.ok(ApiResponse.success(deviceClient.bulkImportDevices(request)));
    }

    @GetMapping("/{deviceId}")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN', 'TENANT_ADMIN', 'USER_ADMIN', 'HELPDESK')")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getDevice(@PathVariable UUID deviceId) {
        return ResponseEntity.ok(ApiResponse.success(deviceClient.getDevice(deviceId)));
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('SUPER_ADMIN', 'TENANT_ADMIN', 'USER_ADMIN', 'HELPDESK')")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> listDevices(
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String type,
            @RequestParam(required = false) String vendor,
            @RequestParam(required = false) String model) {
        return ResponseEntity.ok(ApiResponse.success(
                deviceClient.listDevices(status, type, vendor, model)));
    }

    @PatchMapping("/{deviceId}")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN', 'TENANT_ADMIN', 'USER_ADMIN')")
    public ResponseEntity<ApiResponse<Map<String, Object>>> updateDeviceMetadata(
            @PathVariable UUID deviceId,
            @RequestBody Map<String, Object> request) {
        return ResponseEntity.ok(ApiResponse.success(
                deviceClient.updateDeviceMetadata(deviceId, request)));
    }

    @PostMapping("/{deviceId}/retire")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN', 'TENANT_ADMIN')")
    public ResponseEntity<ApiResponse<Void>> retireDevice(@PathVariable UUID deviceId) {
        deviceClient.retireDevice(deviceId);
        return ResponseEntity.ok(ApiResponse.success(null));
    }

    @PostMapping("/{deviceId}/decommission")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN', 'TENANT_ADMIN')")
    public ResponseEntity<ApiResponse<Void>> decommissionDevice(@PathVariable UUID deviceId) {
        deviceClient.decommissionDevice(deviceId);
        return ResponseEntity.ok(ApiResponse.success(null));
    }

    // ==== B. Device Assignment Module ====

    @PostMapping("/assignments")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN', 'TENANT_ADMIN', 'USER_ADMIN')")
    public ResponseEntity<ApiResponse<Map<String, Object>>> createAssignment(
            @RequestBody Map<String, Object> request) {
        return ResponseEntity.ok(ApiResponse.success(deviceClient.createAssignment(request)));
    }

    @PatchMapping("/assignments/{assignmentId}/activate")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN', 'TENANT_ADMIN', 'USER_ADMIN', 'HELPDESK')")
    public ResponseEntity<ApiResponse<Void>> activateAssignment(@PathVariable UUID assignmentId) {
        deviceClient.activateAssignment(assignmentId);
        return ResponseEntity.ok(ApiResponse.success(null));
    }

    @PatchMapping("/assignments/{assignmentId}/revoke")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN', 'TENANT_ADMIN', 'USER_ADMIN')")
    public ResponseEntity<ApiResponse<Void>> revokeAssignment(
            @PathVariable UUID assignmentId,
            @RequestBody Map<String, Object> request) {
        deviceClient.revokeAssignment(assignmentId, request);
        return ResponseEntity.ok(ApiResponse.success(null));
    }

    @PatchMapping("/assignments/{assignmentId}/return")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN', 'TENANT_ADMIN', 'USER_ADMIN', 'HELPDESK')")
    public ResponseEntity<ApiResponse<Void>> returnDevice(@PathVariable UUID assignmentId) {
        deviceClient.returnDevice(assignmentId);
        return ResponseEntity.ok(ApiResponse.success(null));
    }

    @PostMapping("/assignments/{assignmentId}/reassign")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN', 'TENANT_ADMIN', 'USER_ADMIN')")
    public ResponseEntity<ApiResponse<Map<String, Object>>> reassignDevice(
            @PathVariable UUID assignmentId,
            @RequestBody Map<String, Object> request) {
        return ResponseEntity.ok(ApiResponse.success(
                deviceClient.reassignDevice(assignmentId, request)));
    }

    @GetMapping("/assignments/available")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN', 'TENANT_ADMIN', 'USER_ADMIN')")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> getAvailableDevices() {
        return ResponseEntity.ok(ApiResponse.success(deviceClient.getAvailableDevices()));
    }

    // ==== Delivery Tracking ====

    @PostMapping("/{deviceId}/delivery-events")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN', 'TENANT_ADMIN', 'USER_ADMIN', 'HELPDESK')")
    public ResponseEntity<ApiResponse<Map<String, Object>>> addDeliveryEvent(
            @PathVariable UUID deviceId,
            @RequestBody Map<String, Object> request) {
        return ResponseEntity.ok(ApiResponse.success(
                deviceClient.addDeliveryEvent(deviceId, request)));
    }

    @GetMapping("/{deviceId}/delivery-events")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN', 'TENANT_ADMIN', 'USER_ADMIN', 'HELPDESK')")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> getDeliveryEvents(
            @PathVariable UUID deviceId) {
        return ResponseEntity.ok(ApiResponse.success(deviceClient.getDeliveryEvents(deviceId)));
    }

    // ==== C. User/Account Detail integration (assigned devices tab) ====

    @GetMapping("/assignments/user/{userId}")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN', 'TENANT_ADMIN', 'USER_ADMIN', 'HELPDESK')")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> listDevicesByUser(
            @PathVariable UUID userId) {
        return ResponseEntity.ok(ApiResponse.success(
                deviceClient.listAssignmentsByUser(userId)));
    }

    @GetMapping("/assignments/account/{accountId}")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN', 'TENANT_ADMIN', 'USER_ADMIN', 'HELPDESK')")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> listDevicesByAccount(
            @PathVariable UUID accountId) {
        return ResponseEntity.ok(ApiResponse.success(
                deviceClient.listAssignmentsByAccount(accountId)));
    }

    @GetMapping("/account/{accountId}/eligible-devices")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN', 'TENANT_ADMIN', 'USER_ADMIN', 'HELPDESK')")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> getEligibleDevices(
            @PathVariable UUID accountId) {
        return ResponseEntity.ok(ApiResponse.success(
                deviceClient.getEligibleDevices(accountId)));
    }

    @PostMapping("/validate-enrollment")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN', 'TENANT_ADMIN', 'USER_ADMIN', 'HELPDESK')")
    public ResponseEntity<ApiResponse<Map<String, Object>>> validateEnrollment(
            @RequestBody Map<String, Object> request) {
        return ResponseEntity.ok(ApiResponse.success(deviceClient.validateEnrollment(request)));
    }

    // ==== Lifecycle History ====

    @GetMapping("/{deviceId}/lifecycle-history")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN', 'TENANT_ADMIN', 'USER_ADMIN', 'HELPDESK')")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> getDeviceLifecycleHistory(
            @PathVariable UUID deviceId) {
        return ResponseEntity.ok(ApiResponse.success(
                deviceClient.getDeviceLifecycleHistory(deviceId)));
    }

    // ==== Bootstrap State ====

    @GetMapping("/account/{accountId}/bootstrap-state")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN', 'TENANT_ADMIN', 'USER_ADMIN', 'HELPDESK')")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getBootstrapState(
            @PathVariable UUID accountId) {
        return ResponseEntity.ok(ApiResponse.success(
                deviceClient.getBootstrapState(accountId)));
    }
}
