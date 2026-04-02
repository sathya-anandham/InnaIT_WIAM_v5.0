package io.innait.wiam.identityservice.repository;

import io.innait.wiam.identityservice.entity.RoleEntitlementMap;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface RoleEntitlementMapRepository extends JpaRepository<RoleEntitlementMap, UUID> {

    List<RoleEntitlementMap> findByRoleIdAndActive(UUID roleId, boolean active);

    List<RoleEntitlementMap> findByEntitlementIdAndActive(UUID entitlementId, boolean active);

    List<RoleEntitlementMap> findByRoleId(UUID roleId);
}
