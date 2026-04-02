package io.innait.wiam.adminconfigservice.repository;

import io.innait.wiam.adminconfigservice.entity.OrgUnit;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface OrgUnitRepository extends JpaRepository<OrgUnit, UUID> {

    List<OrgUnit> findByTenantId(UUID tenantId);

    List<OrgUnit> findByTenantIdAndParentOrgUnitIdIsNull(UUID tenantId);

    List<OrgUnit> findByParentOrgUnitId(UUID parentOrgUnitId);

    Optional<OrgUnit> findByTenantIdAndOrgCode(UUID tenantId, String orgCode);
}
