package io.innait.wiam.authorchestrator.repository;

import io.innait.wiam.authorchestrator.entity.AttemptStatus;
import io.innait.wiam.authorchestrator.entity.LoginAttempt;
import io.innait.wiam.authorchestrator.entity.LoginAttemptId;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.Instant;
import java.util.UUID;

public interface LoginAttemptRepository extends JpaRepository<LoginAttempt, LoginAttemptId> {

    long countByAccountIdAndAttemptStatusAndAttemptedAtAfter(
            UUID accountId, AttemptStatus status, Instant after);
}
