package io.innait.wiam.credentialservice.repository;

import io.innait.wiam.credentialservice.entity.BackupCode;
import io.innait.wiam.credentialservice.entity.BackupCodeStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface BackupCodeRepository extends JpaRepository<BackupCode, UUID> {

    List<BackupCode> findByAccountIdAndStatus(UUID accountId, BackupCodeStatus status);

    List<BackupCode> findByAccountId(UUID accountId);

    long countByAccountIdAndStatus(UUID accountId, BackupCodeStatus status);
}
