package io.innait.wiam.sessionservice.repository;

import io.innait.wiam.sessionservice.entity.SessionContext;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface SessionContextRepository extends JpaRepository<SessionContext, UUID> {

    Optional<SessionContext> findBySessionId(UUID sessionId);
}
