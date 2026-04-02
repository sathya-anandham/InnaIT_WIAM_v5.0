package io.innait.wiam.adminconfigservice.repository;

import io.innait.wiam.adminconfigservice.entity.AppStatus;
import io.innait.wiam.adminconfigservice.entity.Application;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface ApplicationRepository extends JpaRepository<Application, UUID> {

    List<Application> findByTenantId(UUID tenantId);

    List<Application> findByTenantIdAndStatus(UUID tenantId, AppStatus status);

    Optional<Application> findByTenantIdAndAppCode(UUID tenantId, String appCode);
}
