package io.innait.wiam.credentialservice.repository;

import io.innait.wiam.common.constant.CredentialStatus;
import io.innait.wiam.credentialservice.entity.FidoCredential;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface FidoCredentialRepository extends JpaRepository<FidoCredential, UUID> {

    List<FidoCredential> findByAccountIdAndCredentialStatus(UUID accountId, CredentialStatus status);

    List<FidoCredential> findByAccountId(UUID accountId);

    Optional<FidoCredential> findByCredentialId(String credentialId);

    long countByAccountIdAndCredentialStatus(UUID accountId, CredentialStatus status);
}
