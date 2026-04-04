package io.innait.wiam.credentialservice.repository;

import io.innait.wiam.credentialservice.entity.AuthMagicLinkEvent;
import io.innait.wiam.credentialservice.entity.MagicLinkEventStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public interface AuthMagicLinkEventRepository extends JpaRepository<AuthMagicLinkEvent, UUID> {

    List<AuthMagicLinkEvent> findByAuthTxnId(UUID authTxnId);

    List<AuthMagicLinkEvent> findByAccountIdOrderByCreatedAtDesc(UUID accountId);

    List<AuthMagicLinkEvent> findByAccountIdAndEventStatus(UUID accountId, MagicLinkEventStatus status);

    @Query("SELECT COUNT(e) FROM AuthMagicLinkEvent e WHERE e.accountId = :accountId " +
           "AND e.eventStatus = 'SENT' AND e.createdAt > :since")
    long countRecentSendsByAccount(@Param("accountId") UUID accountId,
                                    @Param("since") Instant since);

    @Query("SELECT e FROM AuthMagicLinkEvent e WHERE e.tenantId = :tenantId " +
           "AND e.accountId = :accountId ORDER BY e.createdAt DESC")
    List<AuthMagicLinkEvent> findByTenantAndAccount(@Param("tenantId") UUID tenantId,
                                                     @Param("accountId") UUID accountId);
}
