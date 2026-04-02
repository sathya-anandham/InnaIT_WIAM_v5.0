package io.innait.wiam.adminconfigservice.repository;

import io.innait.wiam.adminconfigservice.entity.SystemSetting;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface SystemSettingRepository extends JpaRepository<SystemSetting, UUID> {

    @Query("SELECT s FROM SystemSetting s WHERE s.tenantId = :tenantId AND s.settingKey = :key")
    Optional<SystemSetting> findTenantSetting(
            @Param("tenantId") UUID tenantId, @Param("key") String key);

    @Query("SELECT s FROM SystemSetting s WHERE s.tenantId IS NULL AND s.settingKey = :key")
    Optional<SystemSetting> findGlobalSetting(@Param("key") String key);

    @Query("SELECT s FROM SystemSetting s WHERE s.tenantId IS NULL")
    List<SystemSetting> findAllGlobalSettings();

    @Query("SELECT s FROM SystemSetting s WHERE s.tenantId = :tenantId")
    List<SystemSetting> findAllTenantSettings(@Param("tenantId") UUID tenantId);
}
