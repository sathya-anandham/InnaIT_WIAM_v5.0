package io.innait.wiam.credentialservice.repository;

import io.innait.wiam.credentialservice.entity.ActivationStatus;
import io.innait.wiam.credentialservice.entity.SoftTokenCredential;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface SoftTokenCredentialRepository extends JpaRepository<SoftTokenCredential, UUID> {

    Optional<SoftTokenCredential> findByDeviceId(String deviceId);

    List<SoftTokenCredential> findByAccountIdAndActivationStatus(UUID accountId, ActivationStatus status);

    List<SoftTokenCredential> findByAccountId(UUID accountId);

    long countByAccountIdAndActivationStatus(UUID accountId, ActivationStatus status);
}
