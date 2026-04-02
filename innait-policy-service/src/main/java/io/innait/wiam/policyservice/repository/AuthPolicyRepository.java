package io.innait.wiam.policyservice.repository;

import io.innait.wiam.policyservice.entity.AuthPolicy;
import io.innait.wiam.policyservice.entity.PolicyStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface AuthPolicyRepository extends JpaRepository<AuthPolicy, UUID> {

    List<AuthPolicy> findByTenantIdAndStatusOrderByPriorityAsc(UUID tenantId, PolicyStatus status);
}
