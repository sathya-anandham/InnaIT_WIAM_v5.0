package io.innait.wiam.credentialservice.repository;

import io.innait.wiam.common.constant.CredentialStatus;
import io.innait.wiam.credentialservice.entity.TotpCredential;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface TotpCredentialRepository extends JpaRepository<TotpCredential, UUID> {

    List<TotpCredential> findByAccountIdAndCredentialStatus(UUID accountId, CredentialStatus status);

    Optional<TotpCredential> findByAccountIdAndVerifiedTrueAndCredentialStatus(
            UUID accountId, CredentialStatus status);

    List<TotpCredential> findByAccountId(UUID accountId);

    long countByAccountIdAndCredentialStatus(UUID accountId, CredentialStatus status);
}
