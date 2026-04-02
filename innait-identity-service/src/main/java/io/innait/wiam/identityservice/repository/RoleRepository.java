package io.innait.wiam.identityservice.repository;

import io.innait.wiam.common.constant.RoleType;
import io.innait.wiam.identityservice.entity.Role;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface RoleRepository extends JpaRepository<Role, UUID> {

    Optional<Role> findByTenantIdAndRoleCode(UUID tenantId, String roleCode);

    Page<Role> findByTenantIdAndRoleType(UUID tenantId, RoleType roleType, Pageable pageable);

    Page<Role> findByTenantId(UUID tenantId, Pageable pageable);
}
