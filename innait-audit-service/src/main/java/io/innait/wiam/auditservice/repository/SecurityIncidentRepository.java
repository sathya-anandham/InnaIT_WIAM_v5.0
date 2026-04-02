package io.innait.wiam.auditservice.repository;

import io.innait.wiam.auditservice.entity.IncidentSeverity;
import io.innait.wiam.auditservice.entity.IncidentStatus;
import io.innait.wiam.auditservice.entity.SecurityIncident;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.UUID;

@Repository
public interface SecurityIncidentRepository extends JpaRepository<SecurityIncident, UUID> {

    @Query("SELECT s FROM SecurityIncident s WHERE s.tenantId = :tenantId " +
            "AND (:severity IS NULL OR s.severity = :severity) " +
            "AND (:status IS NULL OR s.status = :status) " +
            "ORDER BY s.detectedAt DESC")
    Page<SecurityIncident> findByFilters(
            @Param("tenantId") UUID tenantId,
            @Param("severity") IncidentSeverity severity,
            @Param("status") IncidentStatus status,
            Pageable pageable);
}
