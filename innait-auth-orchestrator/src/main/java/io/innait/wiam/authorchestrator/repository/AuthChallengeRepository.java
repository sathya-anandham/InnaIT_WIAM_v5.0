package io.innait.wiam.authorchestrator.repository;

import io.innait.wiam.authorchestrator.entity.AuthChallenge;
import io.innait.wiam.authorchestrator.entity.ChallengeStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface AuthChallengeRepository extends JpaRepository<AuthChallenge, UUID> {

    List<AuthChallenge> findByAuthTxnIdAndChallengeStatus(UUID authTxnId, ChallengeStatus status);

    List<AuthChallenge> findByAuthTxnId(UUID authTxnId);
}
