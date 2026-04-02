package io.innait.wiam.credentialservice.repository;

import io.innait.wiam.credentialservice.entity.PasswordHistory;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface PasswordHistoryRepository extends JpaRepository<PasswordHistory, UUID> {

    List<PasswordHistory> findByAccountIdOrderByCreatedAtDesc(UUID accountId);

    List<PasswordHistory> findTop10ByAccountIdOrderByCreatedAtDesc(UUID accountId);
}
