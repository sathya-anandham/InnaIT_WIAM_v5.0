package io.innait.wiam.credentialservice.repository;

import io.innait.wiam.credentialservice.entity.AssignmentStatus;
import io.innait.wiam.credentialservice.entity.DeviceAssignment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface DeviceAssignmentRepository extends JpaRepository<DeviceAssignment, UUID> {

    Optional<DeviceAssignment> findByDeviceIdAndActiveTrue(UUID deviceId);

    List<DeviceAssignment> findByAccountIdAndActiveTrue(UUID accountId);

    List<DeviceAssignment> findByUserIdAndActiveTrue(UUID userId);

    List<DeviceAssignment> findByTenantIdAndAssignmentStatus(UUID tenantId, AssignmentStatus status);

    @Query("SELECT a FROM DeviceAssignment a WHERE a.accountId = :accountId " +
           "AND a.active = true AND a.assignmentStatus IN ('ALLOCATED', 'PENDING', 'ACTIVE')")
    List<DeviceAssignment> findEligibleAssignmentsByAccount(@Param("accountId") UUID accountId);

    @Query("SELECT a FROM DeviceAssignment a WHERE a.deviceId = :deviceId " +
           "AND a.accountId = :accountId AND a.active = true")
    Optional<DeviceAssignment> findActiveByDeviceAndAccount(@Param("deviceId") UUID deviceId,
                                                             @Param("accountId") UUID accountId);

    long countByDeviceIdAndActiveTrue(UUID deviceId);

    List<DeviceAssignment> findByDeviceId(UUID deviceId);
}
