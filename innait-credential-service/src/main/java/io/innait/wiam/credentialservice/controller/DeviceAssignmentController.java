package io.innait.wiam.credentialservice.controller;

import io.innait.wiam.common.dto.ApiResponse;
import io.innait.wiam.credentialservice.dto.*;
import io.innait.wiam.credentialservice.entity.DeviceAssignment;
import io.innait.wiam.credentialservice.entity.DeviceRegistry;
import io.innait.wiam.credentialservice.repository.DeviceAssignmentRepository;
import io.innait.wiam.credentialservice.service.DeviceAssignmentService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/v1/device-assignments")
public class DeviceAssignmentController {

    private final DeviceAssignmentService assignmentService;
    private final DeviceAssignmentRepository assignmentRepo;

    public DeviceAssignmentController(DeviceAssignmentService assignmentService,
                                       DeviceAssignmentRepository assignmentRepo) {
        this.assignmentService = assignmentService;
        this.assignmentRepo = assignmentRepo;
    }

    @PostMapping
    public ResponseEntity<ApiResponse<DeviceAssignmentResponse>> createAssignment(
            @Valid @RequestBody CreateAssignmentRequest request) {
        DeviceAssignment assignment;
        if (request.userId() != null) {
            assignment = assignmentService.assignDeviceToUser(
                    request.deviceId(), request.userId(), request.accountId(), null);
        } else {
            assignment = assignmentService.assignDeviceToAccount(
                    request.deviceId(), request.accountId(), null);
        }
        return ResponseEntity.ok(ApiResponse.success(toResponse(assignment)));
    }

    @PatchMapping("/{assignmentId}/activate")
    public ResponseEntity<ApiResponse<Void>> activateAssignment(@PathVariable UUID assignmentId) {
        assignmentService.activateAssignment(assignmentId);
        return ResponseEntity.ok(ApiResponse.success(null));
    }

    @PatchMapping("/{assignmentId}/revoke")
    public ResponseEntity<ApiResponse<Void>> revokeAssignment(
            @PathVariable UUID assignmentId,
            @Valid @RequestBody RevokeAssignmentRequest request) {
        assignmentService.revokeAssignment(assignmentId, null, request.reason());
        return ResponseEntity.ok(ApiResponse.success(null));
    }

    @PatchMapping("/{assignmentId}/return")
    public ResponseEntity<ApiResponse<Void>> returnDevice(@PathVariable UUID assignmentId) {
        assignmentService.returnDevice(assignmentId, null);
        return ResponseEntity.ok(ApiResponse.success(null));
    }

    @PostMapping("/{assignmentId}/reassign")
    public ResponseEntity<ApiResponse<DeviceAssignmentResponse>> reassignDevice(
            @PathVariable UUID assignmentId,
            @Valid @RequestBody ReassignDeviceRequest request) {
        DeviceAssignment existing = assignmentRepo.findById(assignmentId)
                .orElseThrow(() -> new IllegalArgumentException("Assignment not found: " + assignmentId));
        DeviceAssignment newAssignment = assignmentService.reassignDevice(
                existing.getDeviceId(),
                request.newUserId(),
                request.newAccountId(),
                null
        );
        return ResponseEntity.ok(ApiResponse.success(toResponse(newAssignment)));
    }

    @GetMapping("/user/{userId}")
    public ResponseEntity<ApiResponse<List<DeviceAssignmentResponse>>> listByUser(@PathVariable UUID userId) {
        List<DeviceAssignment> assignments = assignmentService.listAssignedDevicesForUser(userId);
        List<DeviceAssignmentResponse> responses = assignments.stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
        return ResponseEntity.ok(ApiResponse.success(responses));
    }

    @GetMapping("/account/{accountId}")
    public ResponseEntity<ApiResponse<List<DeviceAssignmentResponse>>> listByAccount(
            @PathVariable UUID accountId) {
        List<DeviceAssignment> assignments = assignmentService.listAssignedDevicesForAccount(accountId);
        List<DeviceAssignmentResponse> responses = assignments.stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
        return ResponseEntity.ok(ApiResponse.success(responses));
    }

    @GetMapping("/available")
    public ResponseEntity<ApiResponse<List<DeviceRegistryResponse>>> getAvailableDevices() {
        List<DeviceRegistry> devices = assignmentService.getAvailableDevices();
        List<DeviceRegistryResponse> responses = devices.stream()
                .map(this::toDeviceResponse)
                .collect(Collectors.toList());
        return ResponseEntity.ok(ApiResponse.success(responses));
    }

    // ---- Mappers ----

    private DeviceAssignmentResponse toResponse(DeviceAssignment assignment) {
        return new DeviceAssignmentResponse(
                assignment.getId(),
                assignment.getDeviceId(),
                assignment.getUserId(),
                assignment.getAccountId(),
                assignment.getAssignmentType() != null ? assignment.getAssignmentType().name() : null,
                assignment.getAssignmentStatus() != null ? assignment.getAssignmentStatus().name() : null,
                assignment.getDeliveryStatus() != null ? assignment.getDeliveryStatus().name() : null,
                assignment.getAssignedAt(),
                assignment.getEffectiveFrom(),
                assignment.getEffectiveTo(),
                assignment.getAssignedBy(),
                assignment.isActive(),
                assignment.getCreatedAt()
        );
    }

    private DeviceRegistryResponse toDeviceResponse(DeviceRegistry device) {
        return new DeviceRegistryResponse(
                device.getId(),
                device.getDeviceType().name(),
                device.getDeviceCategory(),
                device.getDeviceModel(),
                device.getDeviceVendor(),
                device.getDeviceSerialNo(),
                device.getDeviceUniqueRef(),
                device.getDeviceStatus().name(),
                device.getOwnershipMode().name(),
                device.getProcurementBatchId(),
                device.getPurchaseDate(),
                device.getWarrantyExpiry(),
                device.isActive(),
                device.getCreatedAt(),
                device.getUpdatedAt()
        );
    }
}
