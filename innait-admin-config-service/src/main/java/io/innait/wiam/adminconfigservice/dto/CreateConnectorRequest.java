package io.innait.wiam.adminconfigservice.dto;

import io.innait.wiam.adminconfigservice.entity.ConnectorType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.util.Map;

public record CreateConnectorRequest(
        @NotBlank String connectorName,
        @NotNull ConnectorType connectorType,
        @NotNull Map<String, Object> config
) {}
