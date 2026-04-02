package io.innait.wiam.adminconfigservice.repository;

import io.innait.wiam.adminconfigservice.entity.FeatureFlag;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface FeatureFlagRepository extends JpaRepository<FeatureFlag, UUID> {

    List<FeatureFlag> findByTenantId(UUID tenantId);

    @Query("SELECT f FROM FeatureFlag f WHERE f.tenantId = :tenantId AND f.flagKey = :flagKey")
    Optional<FeatureFlag> findByTenantIdAndFlagKey(
            @Param("tenantId") UUID tenantId, @Param("flagKey") String flagKey);
}
