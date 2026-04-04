package io.innait.wiam.credentialservice.service;

import io.innait.wiam.common.context.CorrelationContext;
import io.innait.wiam.common.context.TenantContext;
import io.innait.wiam.common.event.EventEnvelope;
import io.innait.wiam.common.exception.ResourceNotFoundException;
import io.innait.wiam.common.kafka.EventPublisher;
import io.innait.wiam.common.kafka.InnaITTopics;
import io.innait.wiam.credentialservice.entity.*;
import io.innait.wiam.credentialservice.repository.DeviceAssignmentRepository;
import io.innait.wiam.credentialservice.repository.DeviceRegistryRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.*;

@Service
@Transactional
public class DeviceAssignmentService {

    private static final Logger log = LoggerFactory.getLogger(DeviceAssignmentService.class);

    private final DeviceAssignmentRepository assignmentRepo;
    private final DeviceRegistryRepository deviceRepo;
    private final DeviceValidationService validationService;
    private final DeviceLifecycleService lifecycleService;
    private final EventPublisher eventPublisher;

    public DeviceAssignmentService(DeviceAssignmentRepository assignmentRepo,
                                    DeviceRegistryRepository deviceRepo,
                                    DeviceValidationService validationService,
                                    DeviceLifecycleService lifecycleService,
                                    EventPublisher eventPublisher) {
        this.assignmentRepo = assignmentRepo;
        this.deviceRepo = deviceRepo;
        this.validationService = validationService;
        this.lifecycleService = lifecycleService;
        this.eventPublisher = eventPublisher;
    }

    public DeviceAssignment assignDeviceToUser(UUID deviceId, UUID userId, UUID accountId, UUID assignedBy) {
        return createAssignment(deviceId, userId, accountId, assignedBy);
    }

    public DeviceAssignment assignDeviceToAccount(UUID deviceId, UUID accountId, UUID assignedBy) {
        return createAssignment(deviceId, null, accountId, assignedBy);
    }

    private DeviceAssignment createAssignment(UUID deviceId, UUID userId, UUID accountId, UUID assignedBy) {
        UUID tenantId = TenantContext.requireTenantId();

        validationService.validateDeviceAssignable(deviceId);
        validationService.validateDeviceNotAlreadyAssigned(deviceId);
        if (userId != null) {
            validationService.validateUserAccountBelongsToSameTenant(tenantId, accountId, userId);
        }

        DeviceAssignment assignment = new DeviceAssignment();
        assignment.setDeviceId(deviceId);
        assignment.setUserId(userId);
        assignment.setAccountId(accountId);
        assignment.setAssignmentType(AssignmentType.PRIMARY);
        assignment.setAssignmentStatus(AssignmentStatus.ALLOCATED);
        assignment.setAssignedAt(Instant.now());
        assignment.setEffectiveFrom(Instant.now());
        assignment.setDeliveryStatus(DeliveryStatus.PENDING_DISPATCH);
        assignment.setAssignedBy(assignedBy);
        assignment.setActive(true);

        DeviceAssignment saved = assignmentRepo.save(assignment);

        // Transition device status to ALLOCATED
        lifecycleService.syncDeviceStatusWithAssignmentStatus(deviceId, AssignmentStatus.ALLOCATED);

        publishAssignmentEvent(InnaITTopics.DEVICE_ASSIGNED, "device.assigned", saved);
        log.info("Device [{}] assigned to account [{}], user [{}]", deviceId, accountId, userId);
        return saved;
    }

    public void activateAssignment(UUID assignmentId) {
        DeviceAssignment assignment = assignmentRepo.findById(assignmentId)
                .orElseThrow(() -> new ResourceNotFoundException("DeviceAssignment", assignmentId.toString()));

        assignment.setAssignmentStatus(AssignmentStatus.ACTIVE);
        assignmentRepo.save(assignment);

        lifecycleService.syncDeviceStatusWithAssignmentStatus(assignment.getDeviceId(), AssignmentStatus.ACTIVE);

        publishAssignmentEvent(InnaITTopics.DEVICE_ASSIGNMENT_ACTIVATED, "device.assignment.activated", assignment);
        log.info("Assignment [{}] activated for device [{}]", assignmentId, assignment.getDeviceId());
    }

    public void revokeAssignment(UUID assignmentId, UUID revokedBy, String reason) {
        DeviceAssignment assignment = assignmentRepo.findById(assignmentId)
                .orElseThrow(() -> new ResourceNotFoundException("DeviceAssignment", assignmentId.toString()));

        assignment.setAssignmentStatus(AssignmentStatus.REVOKED);
        assignment.setRevokedBy(revokedBy);
        assignment.setRevokedAt(Instant.now());
        assignment.setRevocationReason(reason);
        assignment.setActive(false);
        assignmentRepo.save(assignment);

        lifecycleService.syncDeviceStatusWithAssignmentStatus(assignment.getDeviceId(), AssignmentStatus.REVOKED);

        publishAssignmentEvent(InnaITTopics.DEVICE_ASSIGNMENT_REVOKED, "device.assignment.revoked", assignment);
        log.info("Assignment [{}] revoked for device [{}]", assignmentId, assignment.getDeviceId());
    }

    public void returnDevice(UUID assignmentId, UUID revokedBy) {
        DeviceAssignment assignment = assignmentRepo.findById(assignmentId)
                .orElseThrow(() -> new ResourceNotFoundException("DeviceAssignment", assignmentId.toString()));

        assignment.setAssignmentStatus(AssignmentStatus.RETURNED);
        assignment.setRevokedBy(revokedBy);
        assignment.setRevokedAt(Instant.now());
        assignment.setActive(false);
        assignmentRepo.save(assignment);

        lifecycleService.syncDeviceStatusWithAssignmentStatus(assignment.getDeviceId(), AssignmentStatus.RETURNED);

        // Return device to stock
        lifecycleService.transitionDeviceStatus(assignment.getDeviceId(), DeviceStatus.IN_STOCK,
                revokedBy, "Returned from assignment " + assignmentId);

        publishAssignmentEvent(InnaITTopics.DEVICE_RETURNED, "device.returned", assignment);
        log.info("Device [{}] returned from assignment [{}]", assignment.getDeviceId(), assignmentId);
    }

    public DeviceAssignment reassignDevice(UUID deviceId, UUID newUserId, UUID newAccountId, UUID assignedBy) {
        // Revoke existing assignment
        assignmentRepo.findByDeviceIdAndActiveTrue(deviceId)
                .ifPresent(existing -> {
                    existing.setAssignmentStatus(AssignmentStatus.REVOKED);
                    existing.setRevokedBy(assignedBy);
                    existing.setRevokedAt(Instant.now());
                    existing.setRevocationReason("Reassigned");
                    existing.setActive(false);
                    assignmentRepo.save(existing);
                });

        // Reset device to IN_STOCK before new assignment
        lifecycleService.transitionDeviceStatus(deviceId, DeviceStatus.IN_STOCK,
                assignedBy, "Reassignment - resetting to stock");

        DeviceAssignment newAssignment = createAssignment(deviceId, newUserId, newAccountId, assignedBy);
        publishAssignmentEvent(InnaITTopics.DEVICE_REASSIGNED, "device.reassigned", newAssignment);
        return newAssignment;
    }

    @Transactional(readOnly = true)
    public List<DeviceAssignment> listAssignedDevicesForUser(UUID userId) {
        return assignmentRepo.findByUserIdAndActiveTrue(userId);
    }

    @Transactional(readOnly = true)
    public List<DeviceAssignment> listAssignedDevicesForAccount(UUID accountId) {
        return assignmentRepo.findByAccountIdAndActiveTrue(accountId);
    }

    @Transactional(readOnly = true)
    public List<DeviceRegistry> getAvailableDevices() {
        UUID tenantId = TenantContext.requireTenantId();
        return deviceRepo.findAvailableDevices(tenantId);
    }

    private void publishAssignmentEvent(String topic, String eventType, DeviceAssignment assignment) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("assignmentId", assignment.getId().toString());
        payload.put("deviceId", assignment.getDeviceId().toString());
        payload.put("accountId", assignment.getAccountId().toString());
        if (assignment.getUserId() != null) {
            payload.put("userId", assignment.getUserId().toString());
        }
        payload.put("status", assignment.getAssignmentStatus().name());

        EventEnvelope<Map<String, Object>> event = EventEnvelope.<Map<String, Object>>builder()
                .eventType(eventType)
                .tenantId(TenantContext.getTenantId())
                .correlationId(CorrelationContext.getCorrelationId())
                .payload(payload)
                .build();

        eventPublisher.publish(topic, event);
    }
}
