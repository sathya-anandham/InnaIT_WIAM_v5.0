package io.innait.wiam.common.exception;

import java.util.UUID;

public class TenantMismatchException extends RuntimeException {

    private static final long serialVersionUID = 1L;

    private final UUID expectedTenantId;
    private final UUID actualTenantId;

    public TenantMismatchException(UUID expectedTenantId, UUID actualTenantId) {
        super(String.format("Tenant mismatch: expected %s but got %s", expectedTenantId, actualTenantId));
        this.expectedTenantId = expectedTenantId;
        this.actualTenantId = actualTenantId;
    }

    public UUID getExpectedTenantId() {
        return expectedTenantId;
    }

    public UUID getActualTenantId() {
        return actualTenantId;
    }
}
