package io.innait.wiam.identityservice.repository;

import io.innait.wiam.identityservice.entity.User;
import io.innait.wiam.identityservice.entity.UserStatus;
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
public interface UserRepository extends JpaRepository<User, UUID> {

    Optional<User> findByTenantIdAndEmail(UUID tenantId, String email);

    Optional<User> findByTenantIdAndEmployeeNo(UUID tenantId, String employeeNo);

    @Query("""
            SELECT u FROM User u
            WHERE u.tenantId = :tenantId
            AND LOWER(u.displayName) LIKE :displayName ESCAPE '!'
            AND LOWER(u.email) LIKE :email ESCAPE '!'
            AND (:status IS NULL OR u.status = :status)
            AND (:department IS NULL OR u.department = :department)
            """)
    Page<User> search(
            @Param("tenantId") UUID tenantId,
            @Param("displayName") String displayName,
            @Param("email") String email,
            @Param("status") UserStatus status,
            @Param("department") String department,
            Pageable pageable
    );

    List<User> findByTenantIdAndDeletedAndDeletedAtBefore(UUID tenantId, boolean deleted, Instant cutoffDate);

    /**
     * Bypasses @SQLRestriction to find a soft-deleted user by ID and tenant.
     * Required for restore operations since @SQLRestriction("IS_DELETED = 0") prevents
     * finding records with IS_DELETED = 1 via JPQL.
     */
    @Query(value = "SELECT * FROM USERS WHERE USER_ID = :userId AND TENANT_ID = :tenantId AND IS_DELETED = 1",
            nativeQuery = true)
    Optional<User> findDeletedByIdAndTenantId(@Param("userId") UUID userId, @Param("tenantId") UUID tenantId);

    /**
     * Bypasses @SQLRestriction to find all soft-deleted users for a tenant older than the cutoff date.
     * Required for purge jobs since @SQLRestriction("IS_DELETED = 0") blocks derived queries on deleted records.
     */
    @Query(value = "SELECT * FROM USERS WHERE TENANT_ID = :tenantId AND IS_DELETED = 1 AND DELETED_AT < :cutoffDate",
            nativeQuery = true)
    List<User> findDeletedUsersForPurge(@Param("tenantId") UUID tenantId, @Param("cutoffDate") Instant cutoffDate);

    Page<User> findByTenantIdAndStatus(UUID tenantId, UserStatus status, Pageable pageable);

    Page<User> findByTenantId(UUID tenantId, Pageable pageable);
}
