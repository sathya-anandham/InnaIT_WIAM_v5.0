package io.innait.wiam.identityservice.repository;

import io.innait.wiam.identityservice.entity.AccountGroupMap;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface AccountGroupMapRepository extends JpaRepository<AccountGroupMap, UUID> {

    List<AccountGroupMap> findByAccountIdAndActive(UUID accountId, boolean active);

    List<AccountGroupMap> findByGroupIdAndActive(UUID groupId, boolean active);

    List<AccountGroupMap> findByAccountId(UUID accountId);
}
