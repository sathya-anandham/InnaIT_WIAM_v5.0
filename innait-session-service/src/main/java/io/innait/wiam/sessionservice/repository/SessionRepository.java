package io.innait.wiam.sessionservice.repository;

import io.innait.wiam.sessionservice.entity.Session;
import io.innait.wiam.sessionservice.entity.SessionStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface SessionRepository extends JpaRepository<Session, UUID> {

    Optional<Session> findBySessionId(UUID sessionId);

    @Query("SELECT s FROM Session s WHERE s.accountId = :accountId AND s.sessionStatus = :status ORDER BY s.lastActivityAt ASC")
    List<Session> findByAccountIdAndSessionStatusOrderByLastActivityAtAsc(
            @Param("accountId") UUID accountId,
            @Param("status") SessionStatus status);

    @Query("SELECT COUNT(s) FROM Session s WHERE s.accountId = :accountId AND s.sessionStatus = 'ACTIVE'")
    long countActiveByAccountId(@Param("accountId") UUID accountId);

    @Query("SELECT s FROM Session s WHERE s.accountId = :accountId AND s.sessionStatus IN ('ACTIVE', 'IDLE') ORDER BY s.lastActivityAt DESC")
    List<Session> findActiveSessionsByAccountId(@Param("accountId") UUID accountId);
}
