package io.innait.wiam.adminconfigservice.dto;

public record ConnectorTestResult(
        boolean success,
        String message,
        long latencyMs
) {}
