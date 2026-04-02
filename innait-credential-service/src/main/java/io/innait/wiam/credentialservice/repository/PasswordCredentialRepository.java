package io.innait.wiam.credentialservice.repository;

import io.innait.wiam.common.constant.CredentialStatus;
import io.innait.wiam.credentialservice.entity.PasswordCredential;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface PasswordCredentialRepository extends JpaRepository<PasswordCredential, UUID> {

    Optional<PasswordCredential> findByAccountIdAndActiveTrue(UUID accountId);

    Optional<PasswordCredential> findByAccountIdAndCredentialStatus(UUID accountId, CredentialStatus status);

    List<PasswordCredential> findByAccountIdOrderByCreatedAtDesc(UUID accountId);

    List<PasswordCredential> findByTenantIdAndCredentialStatus(UUID tenantId, CredentialStatus status);
}
