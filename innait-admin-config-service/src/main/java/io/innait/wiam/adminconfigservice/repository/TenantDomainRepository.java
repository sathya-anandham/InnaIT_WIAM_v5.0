package io.innait.wiam.adminconfigservice.repository;

import io.innait.wiam.adminconfigservice.entity.TenantDomain;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface TenantDomainRepository extends JpaRepository<TenantDomain, UUID> {

    List<TenantDomain> findByTenantId(UUID tenantId);

    @Query("SELECT d FROM TenantDomain d WHERE LOWER(d.domainName) = LOWER(:domainName)")
    Optional<TenantDomain> findByDomainNameIgnoreCase(@Param("domainName") String domainName);

    @Query("SELECT d FROM TenantDomain d WHERE d.tenantId = :tenantId AND d.primary = true")
    Optional<TenantDomain> findPrimaryDomain(@Param("tenantId") UUID tenantId);
}
