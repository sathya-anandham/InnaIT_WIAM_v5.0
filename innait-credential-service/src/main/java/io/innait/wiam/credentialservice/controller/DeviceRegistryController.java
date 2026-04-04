package io.innait.wiam.credentialservice.controller;

import io.innait.wiam.common.dto.ApiResponse;
import io.innait.wiam.common.exception.ResourceNotFoundException;
import io.innait.wiam.credentialservice.dto.*;
import io.innait.wiam.credentialservice.entity.*;
import io.innait.wiam.credentialservice.repository.AccountBootstrapStateRepository;
import io.innait.wiam.credentialservice.repository.DeviceAssignmentRepository;
import io.innait.wiam.credentialservice.repository.DeviceDeliveryLogRepository;
import io.innait.wiam.credentialservice.repository.DeviceRegistryRepository;
import io.innait.wiam.credentialservice.service.DeviceInventoryService;
import io.innait.wiam.credentialservice.service.DeviceLifecycleService;
import io.innait.wiam.credentialservice.service.DeviceValidationService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/v1/device-registry")
public class DeviceRegistryController {

    private final DeviceInventoryService inventoryService;
    private final DeviceValidationService validationService;
    private final DeviceLifecycleService lifecycleService;
    private final DeviceRegistryRepository deviceRepo;
    private final DeviceAssignmentRepository assignmentRepo;
    private final DeviceDeliveryLogRepository deliveryLogRepo;
    private final AccountBootstrapStateRepository bootstrapStateRepo;

    public DeviceRegistryController(DeviceInventoryService inventoryService,
                                     DeviceValidationService validationService,
                                     DeviceLifecycleService lifecycleService,
                                     DeviceRegistryRepository deviceRepo,
                                     DeviceAssignmentRepository assignmentRepo,
                                     DeviceDeliveryLogRepository deliveryLogRepo,
                                     AccountBootstrapStateRepository bootstrapStateRepo) {
        this.inventoryService = inventoryService;
        this.validationService = validationService;
        this.lifecycleService = lifecycleService;
        this.deviceRepo = deviceRepo;
        this.assignmentRepo = assignmentRepo;
        this.deliveryLogRepo = deliveryLogRepo;
        this.bootstrapStateRepo = bootstrapStateRepo;
    }

    @PostMapping
    public ResponseEntity<ApiResponse<DeviceRegistryResponse>> registerDevice(
            @Valid @RequestBody RegisterDeviceRequest request) {
        DeviceRegistry device = inventoryService.registerDevice(
                DeviceType.valueOf(request.deviceType()),
                request.deviceUniqueRef(),
                request.deviceSerialNo(),
                request.deviceVendor(),
                request.deviceModel(),
                request.deviceCategory(),
                request.procurementBatchId(),
                request.purchaseDate(),
                request.warrantyExpiry()
        );
        return ResponseEntity.ok(ApiResponse.success(toResponse(device)));
    }

    @PostMapping("/bulk-import")
    public ResponseEntity<ApiResponse<List<DeviceRegistryResponse>>> bulkImport(
            @Valid @RequestBody BulkImportDeviceRequest request) {
        List<DeviceRegistry> devices = request.devices().stream()
                .map(r -> {
                    DeviceRegistry d = new DeviceRegistry();
                    d.setDeviceType(DeviceType.valueOf(r.deviceType()));
                    d.setDeviceUniqueRef(r.deviceUniqueRef());
                    d.setDeviceSerialNo(r.deviceSerialNo());
                    d.setDeviceVendor(r.deviceVendor());
                    d.setDeviceModel(r.deviceModel());
                    d.setDeviceCategory(r.deviceCategory());
                    d.setProcurementBatchId(r.procurementBatchId());
                    d.setPurchaseDate(r.purchaseDate());
                    d.setWarrantyExpiry(r.warrantyExpiry());
                    return d;
                })
                .collect(Collectors.toList());

        List<DeviceRegistry> saved = inventoryService.bulkImportDevices(devices);
        List<DeviceRegistryResponse> responses = saved.stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
        return ResponseEntity.ok(ApiResponse.success(responses));
    }

    @PatchMapping("/{deviceId}")
    public ResponseEntity<ApiResponse<DeviceRegistryResponse>> updateMetadata(
            @PathVariable UUID deviceId,
            @Valid @RequestBody UpdateDeviceMetadataRequest request) {
        DeviceRegistry device = inventoryService.updateDeviceMetadata(
                deviceId,
                request.deviceVendor(),
                request.deviceModel(),
                request.deviceCategory(),
                request.warrantyExpiry()
        );
        return ResponseEntity.ok(ApiResponse.success(toResponse(device)));
    }

    @GetMapping("/{deviceId}")
    public ResponseEntity<ApiResponse<DeviceRegistryResponse>> getDevice(@PathVariable UUID deviceId) {
        DeviceRegistry device = deviceRepo.findById(deviceId)
                .orElseThrow(() -> new ResourceNotFoundException("DeviceRegistry", deviceId.toString()));
        return ResponseEntity.ok(ApiResponse.success(toResponse(device)));
    }

    @GetMapping
    public ResponseEntity<ApiResponse<List<DeviceRegistryResponse>>> listDevices(
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String type,
            @RequestParam(required = false) String vendor,
            @RequestParam(required = false) String model) {
        DeviceStatus deviceStatus = status != null ? DeviceStatus.valueOf(status) : null;
        DeviceType deviceType = type != null ? DeviceType.valueOf(type) : null;

        List<DeviceRegistry> devices = inventoryService.searchDevices(deviceStatus, deviceType, vendor, model);
        List<DeviceRegistryResponse> responses = devices.stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
        return ResponseEntity.ok(ApiResponse.success(responses));
    }

    @PostMapping("/{deviceId}/retire")
    public ResponseEntity<ApiResponse<Void>> retireDevice(@PathVariable UUID deviceId) {
        inventoryService.retireDevice(deviceId, null);
        return ResponseEntity.ok(ApiResponse.success(null));
    }

    @PostMapping("/{deviceId}/decommission")
    public ResponseEntity<ApiResponse<Void>> decommissionDevice(@PathVariable UUID deviceId) {
        inventoryService.decommissionDevice(deviceId, null);
        return ResponseEntity.ok(ApiResponse.success(null));
    }

    // ---- Delivery Tracking ----

    @PostMapping("/{deviceId}/delivery-events")
    public ResponseEntity<ApiResponse<DeliveryEventResponse>> addDeliveryEvent(
            @PathVariable UUID deviceId,
            @Valid @RequestBody DeliveryEventRequest request) {
        DeviceDeliveryLog log = new DeviceDeliveryLog();
        log.setDeviceId(deviceId);
        log.setDeviceAssignmentId(request.deviceAssignmentId());
        log.setEventType(DeliveryEventType.valueOf(request.eventType()));
        log.setEventTime(Instant.now());
        log.setComments(request.comments());

        DeviceDeliveryLog saved = deliveryLogRepo.save(log);
        return ResponseEntity.ok(ApiResponse.success(toDeliveryResponse(saved)));
    }

    @GetMapping("/{deviceId}/delivery-events")
    public ResponseEntity<ApiResponse<List<DeliveryEventResponse>>> getDeliveryEvents(
            @PathVariable UUID deviceId) {
        List<DeviceDeliveryLog> events = deliveryLogRepo.findByDeviceIdOrderByEventTimeDesc(deviceId);
        List<DeliveryEventResponse> responses = events.stream()
                .map(this::toDeliveryResponse)
                .collect(Collectors.toList());
        return ResponseEntity.ok(ApiResponse.success(responses));
    }

    // ---- Lifecycle History ----

    @GetMapping("/{deviceId}/lifecycle-history")
    public ResponseEntity<ApiResponse<List<DeviceLifecycleEventResponse>>> getLifecycleHistory(
            @PathVariable UUID deviceId) {
        List<DeviceLifecycleEvent> events = lifecycleService.getDeviceHistory(deviceId);
        List<DeviceLifecycleEventResponse> responses = events.stream()
                .map(this::toLifecycleResponse)
                .collect(Collectors.toList());
        return ResponseEntity.ok(ApiResponse.success(responses));
    }

    // ---- Bootstrap State ----

    @GetMapping("/account/{accountId}/bootstrap-state")
    public ResponseEntity<ApiResponse<BootstrapStateResponse>> getBootstrapState(
            @PathVariable UUID accountId) {
        AccountBootstrapState state = bootstrapStateRepo.findByAccountId(accountId)
                .orElseThrow(() -> new ResourceNotFoundException("AccountBootstrapState", accountId.toString()));
        return ResponseEntity.ok(ApiResponse.success(toBootstrapResponse(state)));
    }

    // ---- Enrollment Validation ----

    @PostMapping("/validate-enrollment")
    public ResponseEntity<ApiResponse<ValidateEnrollmentResponse>> validateEnrollment(
            @Valid @RequestBody ValidateEnrollmentRequest request) {
        try {
            validationService.validateEnrollmentAllowed(request.accountId(), request.deviceId());
            return ResponseEntity.ok(ApiResponse.success(new ValidateEnrollmentResponse(
                    true, request.deviceId(), request.accountId(), null, null, null)));
        } catch (IllegalStateException e) {
            return ResponseEntity.ok(ApiResponse.success(new ValidateEnrollmentResponse(
                    false, request.deviceId(), request.accountId(), null, null, e.getMessage())));
        }
    }

    @GetMapping("/account/{accountId}/eligible-devices")
    public ResponseEntity<ApiResponse<List<DeviceRegistryResponse>>> getEligibleDevices(
            @PathVariable UUID accountId) {
        // Get devices with active eligible assignments (ALLOCATED/PENDING/ACTIVE) for this account
        List<DeviceAssignment> eligibleAssignments = assignmentRepo.findEligibleAssignmentsByAccount(accountId);
        List<DeviceRegistryResponse> responses = eligibleAssignments.stream()
                .map(assignment -> deviceRepo.findById(assignment.getDeviceId()).orElse(null))
                .filter(device -> device != null)
                .map(this::toResponse)
                .collect(Collectors.toList());
        return ResponseEntity.ok(ApiResponse.success(responses));
    }

    // ---- Mappers ----

    private DeviceRegistryResponse toResponse(DeviceRegistry device) {
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

    private DeviceLifecycleEventResponse toLifecycleResponse(DeviceLifecycleEvent event) {
        return new DeviceLifecycleEventResponse(
                event.getId(),
                event.getDeviceId(),
                event.getEventType(),
                event.getOldStatus(),
                event.getNewStatus(),
                event.getEventTime(),
                event.getActorId(),
                event.getDetail()
        );
    }

    private BootstrapStateResponse toBootstrapResponse(AccountBootstrapState state) {
        return new BootstrapStateResponse(
                state.getId(),
                state.getAccountId(),
                state.getUserId(),
                state.getBootstrapMethod().name(),
                state.isBootstrapEnabled(),
                state.isFirstLoginPending(),
                state.isFidoEnrolled(),
                state.getMagicLinkLastSentAt(),
                state.getMagicLinkLastVerifiedAt(),
                state.getMagicLinkExpiresAt(),
                state.getMagicLinkUsedAt(),
                state.getLastMagicLinkTxnId()
        );
    }

    private DeliveryEventResponse toDeliveryResponse(DeviceDeliveryLog log) {
        return new DeliveryEventResponse(
                log.getId(),
                log.getDeviceId(),
                log.getDeviceAssignmentId(),
                log.getEventType().name(),
                log.getEventTime(),
                log.getHandledBy(),
                log.getComments()
        );
    }
}
