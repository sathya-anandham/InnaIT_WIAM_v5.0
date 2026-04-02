package io.innait.wiam.adminconfigservice.dto;

import io.innait.wiam.adminconfigservice.entity.ConnectorStatus;
import io.innait.wiam.adminconfigservice.entity.ConnectorType;

import java.time.Instant;
import java.util.UUID;

public record ConnectorResponse(
        UUID connectorId,
        UUID tenantId,
        String connectorName,
        ConnectorType connectorType,
        ConnectorStatus status,
        Instant lastSyncAt,
        String lastSyncStatus
) {}
