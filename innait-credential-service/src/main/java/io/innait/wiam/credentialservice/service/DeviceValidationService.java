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

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

@Service
public class DeviceValidationService {

    private static final Logger log = LoggerFactory.getLogger(DeviceValidationService.class);

    private final DeviceRegistryRepository deviceRepo;
    private final DeviceAssignmentRepository assignmentRepo;
    private final EventPublisher eventPublisher;

    public DeviceValidationService(DeviceRegistryRepository deviceRepo,
                                    DeviceAssignmentRepository assignmentRepo,
                                    EventPublisher eventPublisher) {
        this.deviceRepo = deviceRepo;
        this.assignmentRepo = assignmentRepo;
        this.eventPublisher = eventPublisher;
    }

    public void validateDeviceAssignable(UUID deviceId) {
        DeviceRegistry device = deviceRepo.findById(deviceId)
                .orElseThrow(() -> new ResourceNotFoundException("DeviceRegistry", deviceId.toString()));

        if (!device.isActive()) {
            throw new IllegalStateException("Device is not active: " + deviceId);
        }

        if (device.getDeviceStatus() != DeviceStatus.IN_STOCK) {
            throw new IllegalStateException(
                    "Device is not available for assignment. Current status: " + device.getDeviceStatus());
        }
    }

    public void validateDeviceNotAlreadyAssigned(UUID deviceId) {
        long activeCount = assignmentRepo.countByDeviceIdAndActiveTrue(deviceId);
        if (activeCount > 0) {
            throw new IllegalStateException("Device already has an active assignment: " + deviceId);
        }
    }

    public void validateUserAccountBelongsToSameTenant(UUID tenantId, UUID accountId, UUID userId) {
        UUID contextTenant = TenantContext.requireTenantId();
        if (!contextTenant.equals(tenantId)) {
            throw new IllegalStateException("Cross-tenant assignment is not allowed");
        }

        // Additional cross-entity tenant validation can be added here
        // when identity-service integration is available
        log.debug("Tenant validation passed for tenant [{}], account [{}], user [{}]",
                tenantId, accountId, userId);
    }

    public void validateEnrollmentAllowed(UUID accountId, UUID deviceId) {
        try {
            DeviceAssignment assignment = assignmentRepo.findActiveByDeviceAndAccount(deviceId, accountId)
                    .orElseThrow(() -> new IllegalStateException(
                            "No active assignment found for device " + deviceId + " and account " + accountId));

            if (assignment.getAssignmentStatus() != AssignmentStatus.ALLOCATED
                    && assignment.getAssignmentStatus() != AssignmentStatus.PENDING) {
                throw new IllegalStateException(
                        "Assignment is not in a state that allows enrollment. Status: " + assignment.getAssignmentStatus());
            }

            DeviceRegistry device = deviceRepo.findById(deviceId)
                    .orElseThrow(() -> new ResourceNotFoundException("DeviceRegistry", deviceId.toString()));

            if (device.getDeviceStatus() != DeviceStatus.ALLOCATED
                    && device.getDeviceStatus() != DeviceStatus.PENDING_ACTIVATION) {
                throw new IllegalStateException(
                        "Device is not in a state that allows enrollment. Status: " + device.getDeviceStatus());
            }
        } catch (IllegalStateException e) {
            publishEnrollmentBlockedEvent(accountId, deviceId, e.getMessage());
            throw e;
        }
    }

    private void publishEnrollmentBlockedEvent(UUID accountId, UUID deviceId, String reason) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("accountId", accountId.toString());
        payload.put("deviceId", deviceId.toString());
        payload.put("reason", reason);

        EventEnvelope<Map<String, Object>> event = EventEnvelope.<Map<String, Object>>builder()
                .eventType("device.enrollment.blocked")
                .tenantId(TenantContext.getTenantId())
                .correlationId(CorrelationContext.getCorrelationId())
                .payload(payload)
                .build();

        eventPublisher.publish(InnaITTopics.DEVICE_ENROLLMENT_BLOCKED, event);
        log.warn("Enrollment blocked for account [{}], device [{}]: {}", accountId, deviceId, reason);
    }

    public void validateAuthenticatedUserCanUseAssignedDevice(UUID userId, UUID accountId, UUID deviceId) {
        DeviceAssignment assignment = assignmentRepo.findActiveByDeviceAndAccount(deviceId, accountId)
                .orElseThrow(() -> new IllegalStateException(
                        "No active assignment found for device " + deviceId + " and account " + accountId));

        if (assignment.getUserId() != null && !assignment.getUserId().equals(userId)) {
            throw new IllegalStateException(
                    "Device is not assigned to user " + userId);
        }

        if (!assignment.isActive()) {
            throw new IllegalStateException("Device assignment is not active");
        }
    }
}
