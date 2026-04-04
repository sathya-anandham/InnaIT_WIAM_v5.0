package io.innait.wiam.credentialservice.repository;

import io.innait.wiam.credentialservice.entity.AccountBootstrapState;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface AccountBootstrapStateRepository extends JpaRepository<AccountBootstrapState, UUID> {

    Optional<AccountBootstrapState> findByTenantIdAndAccountId(UUID tenantId, UUID accountId);

    Optional<AccountBootstrapState> findByAccountId(UUID accountId);

    @Query("SELECT b FROM AccountBootstrapState b WHERE b.accountId = :accountId " +
           "AND b.firstLoginPending = true AND b.bootstrapEnabled = true")
    Optional<AccountBootstrapState> findFirstLoginPendingByAccount(@Param("accountId") UUID accountId);

    @Query("SELECT b FROM AccountBootstrapState b WHERE b.tenantId = :tenantId " +
           "AND b.firstLoginPending = true AND b.bootstrapEnabled = true")
    List<AccountBootstrapState> findAllPendingBootstrapByTenant(@Param("tenantId") UUID tenantId);

    List<AccountBootstrapState> findByUserId(UUID userId);
}
