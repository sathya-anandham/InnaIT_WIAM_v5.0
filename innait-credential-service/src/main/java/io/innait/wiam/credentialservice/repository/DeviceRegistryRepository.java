package io.innait.wiam.credentialservice.repository;

import io.innait.wiam.credentialservice.entity.DeviceRegistry;
import io.innait.wiam.credentialservice.entity.DeviceStatus;
import io.innait.wiam.credentialservice.entity.DeviceType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface DeviceRegistryRepository extends JpaRepository<DeviceRegistry, UUID> {

    List<DeviceRegistry> findByTenantIdAndDeviceStatus(UUID tenantId, DeviceStatus status);

    List<DeviceRegistry> findByTenantIdAndDeviceType(UUID tenantId, DeviceType type);

    List<DeviceRegistry> findByTenantIdAndActiveTrue(UUID tenantId);

    Optional<DeviceRegistry> findByTenantIdAndDeviceUniqueRef(UUID tenantId, String deviceUniqueRef);

    Optional<DeviceRegistry> findByTenantIdAndDeviceSerialNo(UUID tenantId, String deviceSerialNo);

    List<DeviceRegistry> findByProcurementBatchId(UUID batchId);

    @Query("SELECT d FROM DeviceRegistry d WHERE d.tenantId = :tenantId " +
           "AND d.deviceStatus = 'IN_STOCK' AND d.active = true")
    List<DeviceRegistry> findAvailableDevices(@Param("tenantId") UUID tenantId);

    @Query("SELECT d FROM DeviceRegistry d WHERE d.tenantId = :tenantId " +
           "AND d.active = true " +
           "AND (:status IS NULL OR d.deviceStatus = :status) " +
           "AND (:type IS NULL OR d.deviceType = :type) " +
           "AND (:vendor IS NULL OR d.deviceVendor = :vendor) " +
           "AND (:model IS NULL OR d.deviceModel = :model)")
    List<DeviceRegistry> searchDevices(@Param("tenantId") UUID tenantId,
                                       @Param("status") DeviceStatus status,
                                       @Param("type") DeviceType type,
                                       @Param("vendor") String vendor,
                                       @Param("model") String model);

    long countByTenantIdAndDeviceStatus(UUID tenantId, DeviceStatus status);
}
