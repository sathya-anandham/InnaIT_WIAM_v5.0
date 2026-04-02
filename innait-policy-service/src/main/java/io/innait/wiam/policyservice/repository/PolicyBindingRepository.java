package io.innait.wiam.policyservice.repository;

import io.innait.wiam.policyservice.entity.PolicyBinding;
import io.innait.wiam.policyservice.entity.PolicyType;
import io.innait.wiam.policyservice.entity.TargetType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.UUID;

public interface PolicyBindingRepository extends JpaRepository<PolicyBinding, UUID> {

    List<PolicyBinding> findByPolicyTypeAndTargetTypeAndTargetIdAndActiveTrue(
            PolicyType policyType, TargetType targetType, UUID targetId);

    @Query("SELECT b FROM PolicyBinding b WHERE b.policyType = :policyType " +
           "AND b.active = true AND b.tenantId = :tenantId " +
           "AND ((b.targetType = 'USER' AND b.targetId = :accountId) " +
           "  OR (b.targetType = 'GROUP' AND b.targetId IN :groupIds) " +
           "  OR (b.targetType = 'ROLE' AND b.targetId IN :roleIds) " +
           "  OR (b.targetType = 'TENANT' AND b.targetId = :tenantId))")
    List<PolicyBinding> findBindingsForAccount(
            @Param("policyType") PolicyType policyType,
            @Param("tenantId") UUID tenantId,
            @Param("accountId") UUID accountId,
            @Param("groupIds") List<UUID> groupIds,
            @Param("roleIds") List<UUID> roleIds);

    List<PolicyBinding> findByPolicyIdAndActiveTrue(UUID policyId);

    List<PolicyBinding> findByTenantIdAndActiveTrue(UUID tenantId);
}
