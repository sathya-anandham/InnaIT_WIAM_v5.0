package io.innait.wiam.identityservice.repository;

import io.innait.wiam.identityservice.entity.GroupRoleMap;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface GroupRoleMapRepository extends JpaRepository<GroupRoleMap, UUID> {

    List<GroupRoleMap> findByGroupIdAndActive(UUID groupId, boolean active);

    List<GroupRoleMap> findByRoleIdAndActive(UUID roleId, boolean active);

    List<GroupRoleMap> findByGroupId(UUID groupId);
}
