package io.innait.wiam.credentialservice.service;

import io.innait.wiam.common.context.CorrelationContext;
import io.innait.wiam.common.context.TenantContext;
import io.innait.wiam.common.event.EventEnvelope;
import io.innait.wiam.common.exception.ResourceNotFoundException;
import io.innait.wiam.common.kafka.EventPublisher;
import io.innait.wiam.common.kafka.InnaITTopics;
import io.innait.wiam.credentialservice.entity.*;
import io.innait.wiam.credentialservice.repository.DeviceRegistryRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.*;

@Service
@Transactional
public class DeviceInventoryService {

    private static final Logger log = LoggerFactory.getLogger(DeviceInventoryService.class);

    private final DeviceRegistryRepository deviceRepo;
    private final DeviceLifecycleService lifecycleService;
    private final EventPublisher eventPublisher;

    public DeviceInventoryService(DeviceRegistryRepository deviceRepo,
                                   DeviceLifecycleService lifecycleService,
                                   EventPublisher eventPublisher) {
        this.deviceRepo = deviceRepo;
        this.lifecycleService = lifecycleService;
        this.eventPublisher = eventPublisher;
    }

    public DeviceRegistry registerDevice(DeviceType deviceType, String deviceUniqueRef,
                                          String serialNo, String vendor, String model,
                                          String category, UUID procurementBatchId,
                                          Instant purchaseDate, Instant warrantyExpiry) {
        UUID tenantId = TenantContext.requireTenantId();

        // Check uniqueness within tenant
        deviceRepo.findByTenantIdAndDeviceUniqueRef(tenantId, deviceUniqueRef)
                .ifPresent(existing -> {
                    throw new IllegalStateException("Device with unique ref already exists: " + deviceUniqueRef);
                });

        if (serialNo != null) {
            deviceRepo.findByTenantIdAndDeviceSerialNo(tenantId, serialNo)
                    .ifPresent(existing -> {
                        throw new IllegalStateException("Device with serial number already exists: " + serialNo);
                    });
        }

        DeviceRegistry device = new DeviceRegistry();
        device.setDeviceType(deviceType);
        device.setDeviceUniqueRef(deviceUniqueRef);
        device.setDeviceSerialNo(serialNo);
        device.setDeviceVendor(vendor);
        device.setDeviceModel(model);
        device.setDeviceCategory(category);
        device.setProcurementBatchId(procurementBatchId);
        device.setPurchaseDate(purchaseDate);
        device.setWarrantyExpiry(warrantyExpiry);
        device.setDeviceStatus(DeviceStatus.IN_STOCK);
        device.setOwnershipMode(OwnershipMode.DEDICATED);
        device.setActive(true);

        DeviceRegistry saved = deviceRepo.save(device);

        lifecycleService.logLifecycleEvent(saved.getId(), "DEVICE_REGISTERED",
                null, DeviceStatus.IN_STOCK.name(), null, null);

        publishDeviceEvent(InnaITTopics.DEVICE_REGISTERED, "device.registered", saved.getId());
        log.info("Device registered [{}] with ref [{}]", saved.getId(), deviceUniqueRef);
        return saved;
    }

    public List<DeviceRegistry> bulkImportDevices(List<DeviceRegistry> devices) {
        UUID tenantId = TenantContext.requireTenantId();
        List<DeviceRegistry> saved = new ArrayList<>();

        for (DeviceRegistry device : devices) {
            device.setDeviceStatus(DeviceStatus.IN_STOCK);
            device.setOwnershipMode(OwnershipMode.DEDICATED);
            device.setActive(true);

            DeviceRegistry result = deviceRepo.save(device);
            lifecycleService.logLifecycleEvent(result.getId(), "DEVICE_IMPORTED",
                    null, DeviceStatus.IN_STOCK.name(), null, "Bulk import");
            saved.add(result);
        }

        log.info("Bulk imported [{}] devices for tenant [{}]", saved.size(), tenantId);
        return saved;
    }

    public DeviceRegistry updateDeviceMetadata(UUID deviceId, String vendor, String model,
                                                String category, Instant warrantyExpiry) {
        DeviceRegistry device = deviceRepo.findById(deviceId)
                .orElseThrow(() -> new ResourceNotFoundException("DeviceRegistry", deviceId.toString()));

        if (vendor != null) device.setDeviceVendor(vendor);
        if (model != null) device.setDeviceModel(model);
        if (category != null) device.setDeviceCategory(category);
        if (warrantyExpiry != null) device.setWarrantyExpiry(warrantyExpiry);

        DeviceRegistry saved = deviceRepo.save(device);
        lifecycleService.logLifecycleEvent(deviceId, "METADATA_UPDATED",
                null, null, null, null);

        publishDeviceEvent(InnaITTopics.DEVICE_UPDATED, "device.updated", deviceId);
        log.info("Device metadata updated [{}]", deviceId);
        return saved;
    }

    public void markDeviceInStock(UUID deviceId, UUID actorId) {
        lifecycleService.transitionDeviceStatus(deviceId, DeviceStatus.IN_STOCK, actorId, "Returned to stock");
    }

    public void retireDevice(UUID deviceId, UUID actorId) {
        DeviceRegistry device = deviceRepo.findById(deviceId)
                .orElseThrow(() -> new ResourceNotFoundException("DeviceRegistry", deviceId.toString()));

        device.setActive(false);
        deviceRepo.save(device);

        lifecycleService.transitionDeviceStatus(deviceId, DeviceStatus.RETIRED, actorId, "Device retired");
        publishDeviceEvent(InnaITTopics.DEVICE_RETIRED, "device.retired", deviceId);
        log.info("Device retired [{}]", deviceId);
    }

    public void decommissionDevice(UUID deviceId, UUID actorId) {
        DeviceRegistry device = deviceRepo.findById(deviceId)
                .orElseThrow(() -> new ResourceNotFoundException("DeviceRegistry", deviceId.toString()));

        device.setActive(false);
        deviceRepo.save(device);

        lifecycleService.transitionDeviceStatus(deviceId, DeviceStatus.DECOMMISSIONED, actorId, "Device decommissioned");

        publishDeviceEvent(InnaITTopics.DEVICE_DECOMMISSIONED, "device.decommissioned", deviceId);
        log.info("Device decommissioned [{}]", deviceId);
    }

    @Transactional(readOnly = true)
    public List<DeviceRegistry> searchDevices(DeviceStatus status, DeviceType type,
                                               String vendor, String model) {
        UUID tenantId = TenantContext.requireTenantId();
        return deviceRepo.searchDevices(tenantId, status, type, vendor, model);
    }

    @Transactional(readOnly = true)
    public List<DeviceRegistry> getAvailableDevices() {
        UUID tenantId = TenantContext.requireTenantId();
        return deviceRepo.findAvailableDevices(tenantId);
    }

    private void publishDeviceEvent(String topic, String eventType, UUID deviceId) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("deviceId", deviceId.toString());

        EventEnvelope<Map<String, Object>> event = EventEnvelope.<Map<String, Object>>builder()
                .eventType(eventType)
                .tenantId(TenantContext.getTenantId())
                .correlationId(CorrelationContext.getCorrelationId())
                .payload(payload)
                .build();

        eventPublisher.publish(topic, event);
    }
}
