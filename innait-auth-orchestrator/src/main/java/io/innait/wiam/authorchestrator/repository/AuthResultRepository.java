package io.innait.wiam.authorchestrator.repository;

import io.innait.wiam.authorchestrator.entity.AuthResult;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface AuthResultRepository extends JpaRepository<AuthResult, UUID> {

    Optional<AuthResult> findByAuthTxnId(UUID authTxnId);
}
