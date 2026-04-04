package io.innait.wiam.credentialservice.repository;

import io.innait.wiam.credentialservice.entity.DeviceLifecycleEvent;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface DeviceLifecycleEventRepository extends JpaRepository<DeviceLifecycleEvent, UUID> {

    List<DeviceLifecycleEvent> findByDeviceIdOrderByEventTimeDesc(UUID deviceId);

    List<DeviceLifecycleEvent> findByTenantIdAndDeviceId(UUID tenantId, UUID deviceId);

    List<DeviceLifecycleEvent> findByDeviceIdAndEventType(UUID deviceId, String eventType);
}
