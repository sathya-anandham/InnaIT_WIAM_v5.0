package io.innait.wiam.identityservice.repository;

import io.innait.wiam.identityservice.entity.AccountRoleMap;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface AccountRoleMapRepository extends JpaRepository<AccountRoleMap, UUID> {

    List<AccountRoleMap> findByAccountIdAndActive(UUID accountId, boolean active);

    List<AccountRoleMap> findByRoleIdAndActive(UUID roleId, boolean active);

    List<AccountRoleMap> findByAccountId(UUID accountId);
}
