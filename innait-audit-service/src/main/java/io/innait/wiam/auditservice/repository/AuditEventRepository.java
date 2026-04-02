package io.innait.wiam.auditservice.repository;

import io.innait.wiam.auditservice.entity.AuditEvent;
import io.innait.wiam.auditservice.entity.EventCategory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.UUID;

@Repository
public interface AuditEventRepository extends JpaRepository<AuditEvent, UUID> {

    @Query("SELECT e FROM AuditEvent e WHERE e.tenantId = :tenantId " +
            "AND (:category IS NULL OR e.eventCategory = :category) " +
            "AND (:eventType IS NULL OR e.eventType = :eventType) " +
            "AND (:actorId IS NULL OR e.actorId = :actorId) " +
            "AND (:subjectId IS NULL OR e.subjectId = :subjectId) " +
            "AND (:fromTime IS NULL OR e.eventTime >= :fromTime) " +
            "AND (:toTime IS NULL OR e.eventTime <= :toTime) " +
            "ORDER BY e.eventTime DESC")
    Page<AuditEvent> findByFilters(
            @Param("tenantId") UUID tenantId,
            @Param("category") EventCategory category,
            @Param("eventType") String eventType,
            @Param("actorId") UUID actorId,
            @Param("subjectId") UUID subjectId,
            @Param("fromTime") Instant fromTime,
            @Param("toTime") Instant toTime,
            Pageable pageable);

    @Query("SELECT e FROM AuditEvent e WHERE e.correlationId = :correlationId ORDER BY e.eventTime ASC")
    java.util.List<AuditEvent> findByCorrelationId(@Param("correlationId") UUID correlationId);
}
