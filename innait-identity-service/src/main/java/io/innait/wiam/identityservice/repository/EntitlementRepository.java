package io.innait.wiam.identityservice.repository;

import io.innait.wiam.identityservice.entity.Entitlement;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface EntitlementRepository extends JpaRepository<Entitlement, UUID> {

    Optional<Entitlement> findByTenantIdAndEntitlementCode(UUID tenantId, String entitlementCode);

    Page<Entitlement> findByTenantId(UUID tenantId, Pageable pageable);
}
