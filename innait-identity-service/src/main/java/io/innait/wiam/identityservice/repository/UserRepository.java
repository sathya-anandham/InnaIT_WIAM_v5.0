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
            AND (:displayName IS NULL OR LOWER(u.displayName) LIKE LOWER(CONCAT('%', :displayName, '%')))
            AND (:email IS NULL OR LOWER(u.email) LIKE LOWER(CONCAT('%', :email, '%')))
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

    Page<User> findByTenantIdAndStatus(UUID tenantId, UserStatus status, Pageable pageable);

    Page<User> findByTenantId(UUID tenantId, Pageable pageable);
}
