package io.innait.wiam.adminconfigservice.repository;

import io.innait.wiam.adminconfigservice.entity.Connector;
import io.innait.wiam.adminconfigservice.entity.ConnectorType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface ConnectorRepository extends JpaRepository<Connector, UUID> {

    List<Connector> findByTenantId(UUID tenantId);

    List<Connector> findByTenantIdAndConnectorType(UUID tenantId, ConnectorType connectorType);
}
