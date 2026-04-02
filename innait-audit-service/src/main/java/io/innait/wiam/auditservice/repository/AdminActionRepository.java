package io.innait.wiam.auditservice.repository;

import io.innait.wiam.auditservice.entity.AdminAction;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.UUID;

@Repository
public interface AdminActionRepository extends JpaRepository<AdminAction, UUID> {

    @Query("SELECT a FROM AdminAction a WHERE a.tenantId = :tenantId " +
            "AND (:targetType IS NULL OR a.targetType = :targetType) " +
            "AND (:targetId IS NULL OR a.targetId = :targetId) " +
            "ORDER BY a.actionTime DESC")
    Page<AdminAction> findByFilters(
            @Param("tenantId") UUID tenantId,
            @Param("targetType") String targetType,
            @Param("targetId") UUID targetId,
            Pageable pageable);
}
