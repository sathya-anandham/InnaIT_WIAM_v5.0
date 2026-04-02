package io.innait.wiam.credentialservice.repository;

import io.innait.wiam.credentialservice.entity.PasswordPolicy;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface PasswordPolicyRepository extends JpaRepository<PasswordPolicy, UUID> {

    Optional<PasswordPolicy> findByTenantIdAndIsDefaultTrue(UUID tenantId);

    Optional<PasswordPolicy> findByTenantIdAndPolicyName(UUID tenantId, String policyName);
}
