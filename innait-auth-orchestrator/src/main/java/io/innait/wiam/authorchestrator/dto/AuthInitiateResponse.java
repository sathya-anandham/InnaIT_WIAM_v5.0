package io.innait.wiam.authorchestrator.dto;

import java.util.List;
import java.util.UUID;

public record AuthInitiateResponse(
        UUID txnId,
        String state,
        List<String> primaryMethods
) {
}
