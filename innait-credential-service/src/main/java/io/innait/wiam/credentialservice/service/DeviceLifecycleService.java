package io.innait.wiam.credentialservice.service;

import io.innait.wiam.common.context.CorrelationContext;
import io.innait.wiam.common.context.TenantContext;
import io.innait.wiam.common.event.EventEnvelope;
import io.innait.wiam.common.exception.ResourceNotFoundException;
import io.innait.wiam.common.kafka.EventPublisher;
import io.innait.wiam.common.kafka.InnaITTopics;
import io.innait.wiam.credentialservice.entity.DeviceLifecycleEvent;
import io.innait.wiam.credentialservice.entity.DeviceRegistry;
import io.innait.wiam.credentialservice.entity.DeviceStatus;
import io.innait.wiam.credentialservice.entity.AssignmentStatus;
import io.innait.wiam.credentialservice.repository.DeviceLifecycleEventRepository;
import io.innait.wiam.credentialservice.repository.DeviceRegistryRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@Transactional
public class DeviceLifecycleService {

    private static final Logger log = LoggerFactory.getLogger(DeviceLifecycleService.class);

    private final DeviceRegistryRepository deviceRepo;
    private final DeviceLifecycleEventRepository eventRepo;
    private final EventPublisher eventPublisher;

    public DeviceLifecycleService(DeviceRegistryRepository deviceRepo,
                                   DeviceLifecycleEventRepository eventRepo,
                                   EventPublisher eventPublisher) {
        this.deviceRepo = deviceRepo;
        this.eventRepo = eventRepo;
        this.eventPublisher = eventPublisher;
    }

    public void transitionDeviceStatus(UUID deviceId, DeviceStatus newStatus, UUID actorId, String detail) {
        DeviceRegistry device = deviceRepo.findById(deviceId)
                .orElseThrow(() -> new ResourceNotFoundException("DeviceRegistry", deviceId.toString()));

        DeviceStatus oldStatus = device.getDeviceStatus();
        device.setDeviceStatus(newStatus);
        deviceRepo.save(device);

        logLifecycleEvent(deviceId, "STATUS_TRANSITION", oldStatus.name(), newStatus.name(), actorId, detail);

        publishStatusChangeEvent(deviceId, oldStatus, newStatus);
        log.info("Device [{}] transitioned from [{}] to [{}]", deviceId, oldStatus, newStatus);
    }

    public void logLifecycleEvent(UUID deviceId, String eventType, String oldStatus,
                                   String newStatus, UUID actorId, String detail) {
        DeviceLifecycleEvent event = new DeviceLifecycleEvent();
        event.setDeviceId(deviceId);
        event.setEventType(eventType);
        event.setOldStatus(oldStatus);
        event.setNewStatus(newStatus);
        event.setEventTime(Instant.now());
        event.setActorId(actorId);
        event.setDetail(detail);
        eventRepo.save(event);
    }

    public void syncDeviceStatusWithAssignmentStatus(UUID deviceId, AssignmentStatus assignmentStatus) {
        DeviceRegistry device = deviceRepo.findById(deviceId)
                .orElseThrow(() -> new ResourceNotFoundException("DeviceRegistry", deviceId.toString()));

        DeviceStatus targetStatus = mapAssignmentStatusToDeviceStatus(assignmentStatus);
        if (targetStatus != null && device.getDeviceStatus() != targetStatus) {
            DeviceStatus oldStatus = device.getDeviceStatus();
            device.setDeviceStatus(targetStatus);
            deviceRepo.save(device);

            logLifecycleEvent(deviceId, "ASSIGNMENT_SYNC", oldStatus.name(), targetStatus.name(),
                    null, "Synced from assignment status: " + assignmentStatus);

            log.info("Device [{}] status synced to [{}] from assignment status [{}]",
                    deviceId, targetStatus, assignmentStatus);
        }
    }

    @Transactional(readOnly = true)
    public List<DeviceLifecycleEvent> getDeviceHistory(UUID deviceId) {
        return eventRepo.findByDeviceIdOrderByEventTimeDesc(deviceId);
    }

    private DeviceStatus mapAssignmentStatusToDeviceStatus(AssignmentStatus assignmentStatus) {
        return switch (assignmentStatus) {
            case PENDING -> DeviceStatus.ASSIGNED;
            case ALLOCATED -> DeviceStatus.ALLOCATED;
            case ACTIVE -> DeviceStatus.ACTIVE;
            case SUSPENDED -> DeviceStatus.SUSPENDED;
            case REVOKED -> DeviceStatus.REVOKED;
            case RETURNED -> DeviceStatus.RETURNED;
            case EXPIRED -> null;
        };
    }

    private void publishStatusChangeEvent(UUID deviceId, DeviceStatus oldStatus, DeviceStatus newStatus) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("deviceId", deviceId.toString());
        payload.put("oldStatus", oldStatus.name());
        payload.put("newStatus", newStatus.name());

        EventEnvelope<Map<String, Object>> event = EventEnvelope.<Map<String, Object>>builder()
                .eventType("device.status.changed")
                .tenantId(TenantContext.getTenantId())
                .correlationId(CorrelationContext.getCorrelationId())
                .payload(payload)
                .build();

        eventPublisher.publish(InnaITTopics.DEVICE_STATUS_CHANGED, event);

        // Publish specific DEVICE_ACTIVATED event when device transitions to ACTIVE
        if (newStatus == DeviceStatus.ACTIVE) {
            EventEnvelope<Map<String, Object>> activatedEvent = EventEnvelope.<Map<String, Object>>builder()
                    .eventType("device.activated")
                    .tenantId(TenantContext.getTenantId())
                    .correlationId(CorrelationContext.getCorrelationId())
                    .payload(payload)
                    .build();
            eventPublisher.publish(InnaITTopics.DEVICE_ACTIVATED, activatedEvent);
        }
    }
}
