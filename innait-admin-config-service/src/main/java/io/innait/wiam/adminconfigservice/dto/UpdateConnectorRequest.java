package io.innait.wiam.adminconfigservice.dto;

import io.innait.wiam.adminconfigservice.entity.ConnectorStatus;

import java.util.Map;

public record UpdateConnectorRequest(
        String connectorName,
        ConnectorStatus status,
        Map<String, Object> config
) {}
