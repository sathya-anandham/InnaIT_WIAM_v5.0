package io.innait.wiam.identityservice.repository;

import io.innait.wiam.identityservice.entity.Group;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface GroupRepository extends JpaRepository<Group, UUID> {

    Optional<Group> findByTenantIdAndGroupCode(UUID tenantId, String groupCode);

    Page<Group> findByTenantId(UUID tenantId, Pageable pageable);
}
