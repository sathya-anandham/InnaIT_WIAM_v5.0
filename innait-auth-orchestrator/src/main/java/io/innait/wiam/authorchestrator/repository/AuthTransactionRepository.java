package io.innait.wiam.authorchestrator.repository;

import io.innait.wiam.authorchestrator.entity.AuthTransaction;
import io.innait.wiam.authorchestrator.statemachine.AuthState;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;
import java.util.UUID;

public interface AuthTransactionRepository extends JpaRepository<AuthTransaction, UUID> {

    @Query("SELECT t FROM AuthTransaction t WHERE t.authTxnId = :txnId")
    Optional<AuthTransaction> findByAuthTxnId(@Param("txnId") UUID txnId);

    long countByAccountIdAndCurrentState(UUID accountId, AuthState state);
}
