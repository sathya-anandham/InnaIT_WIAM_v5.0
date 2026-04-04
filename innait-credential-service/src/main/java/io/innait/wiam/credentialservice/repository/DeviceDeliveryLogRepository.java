package io.innait.wiam.credentialservice.repository;

import io.innait.wiam.credentialservice.entity.DeviceDeliveryLog;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface DeviceDeliveryLogRepository extends JpaRepository<DeviceDeliveryLog, UUID> {

    List<DeviceDeliveryLog> findByDeviceIdOrderByEventTimeDesc(UUID deviceId);

    List<DeviceDeliveryLog> findByDeviceAssignmentIdOrderByEventTimeDesc(UUID assignmentId);

    List<DeviceDeliveryLog> findByTenantIdAndDeviceId(UUID tenantId, UUID deviceId);
}
