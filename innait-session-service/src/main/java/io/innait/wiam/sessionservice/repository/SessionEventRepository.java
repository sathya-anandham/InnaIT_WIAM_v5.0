package io.innait.wiam.sessionservice.repository;

import io.innait.wiam.sessionservice.entity.SessionEvent;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface SessionEventRepository extends JpaRepository<SessionEvent, UUID> {

    List<SessionEvent> findBySessionIdOrderByEventTimeDesc(UUID sessionId);
}
