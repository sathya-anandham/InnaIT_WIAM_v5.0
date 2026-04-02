package io.innait.wiam.policyservice.repository;

import io.innait.wiam.policyservice.entity.MfaPolicy;
import io.innait.wiam.policyservice.entity.PolicyStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface MfaPolicyRepository extends JpaRepository<MfaPolicy, UUID> {

    List<MfaPolicy> findByTenantIdAndStatus(UUID tenantId, PolicyStatus status);

    Optional<MfaPolicy> findByTenantIdAndIsDefaultTrueAndStatus(UUID tenantId, PolicyStatus status);
}
