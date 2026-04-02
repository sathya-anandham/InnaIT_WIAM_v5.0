package io.innait.wiam.adminconfigservice.repository;

import io.innait.wiam.adminconfigservice.entity.Tenant;
import io.innait.wiam.adminconfigservice.entity.TenantStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface TenantRepository extends JpaRepository<Tenant, UUID> {

    Optional<Tenant> findByTenantCode(String tenantCode);

    boolean existsByTenantCode(String tenantCode);

    Page<Tenant> findByStatus(TenantStatus status, Pageable pageable);
}
