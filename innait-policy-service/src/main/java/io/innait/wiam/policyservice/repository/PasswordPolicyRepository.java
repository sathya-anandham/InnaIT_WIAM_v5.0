package io.innait.wiam.policyservice.repository;

import io.innait.wiam.policyservice.entity.PasswordPolicy;
import io.innait.wiam.policyservice.entity.PolicyStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface PasswordPolicyRepository extends JpaRepository<PasswordPolicy, UUID> {

    List<PasswordPolicy> findByTenantIdAndStatus(UUID tenantId, PolicyStatus status);

    Optional<PasswordPolicy> findByTenantIdAndIsDefaultTrueAndStatus(UUID tenantId, PolicyStatus status);
}
