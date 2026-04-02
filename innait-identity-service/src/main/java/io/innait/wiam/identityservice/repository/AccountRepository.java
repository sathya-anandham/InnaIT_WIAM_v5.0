package io.innait.wiam.identityservice.repository;

import io.innait.wiam.common.constant.AccountStatus;
import io.innait.wiam.identityservice.entity.Account;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface AccountRepository extends JpaRepository<Account, UUID> {

    @Query("SELECT a FROM Account a WHERE a.tenantId = :tenantId AND LOWER(a.loginId) = LOWER(:loginId)")
    Optional<Account> findByTenantIdAndLoginIdIgnoreCase(
            @Param("tenantId") UUID tenantId,
            @Param("loginId") String loginId
    );

    List<Account> findByUserIdOrderByCreatedAtDesc(UUID userId);

    @Query("SELECT a FROM Account a WHERE a.user.id = :userId")
    List<Account> findByUserId(@Param("userId") UUID userId);

    Page<Account> findByTenantIdAndAccountStatus(UUID tenantId, AccountStatus accountStatus, Pageable pageable);

    List<Account> findByTenantIdAndLockedUntilBefore(UUID tenantId, Instant now);

    Page<Account> findByTenantId(UUID tenantId, Pageable pageable);
}
