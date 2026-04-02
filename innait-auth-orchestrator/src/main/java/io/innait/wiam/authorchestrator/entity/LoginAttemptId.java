package io.innait.wiam.authorchestrator.entity;

import java.io.Serializable;
import java.util.Objects;
import java.util.UUID;

public class LoginAttemptId implements Serializable {

    private UUID attemptId;
    private UUID tenantId;

    public LoginAttemptId() {
    }

    public LoginAttemptId(UUID attemptId, UUID tenantId) {
        this.attemptId = attemptId;
        this.tenantId = tenantId;
    }

    public UUID getAttemptId() { return attemptId; }
    public void setAttemptId(UUID attemptId) { this.attemptId = attemptId; }

    public UUID getTenantId() { return tenantId; }
    public void setTenantId(UUID tenantId) { this.tenantId = tenantId; }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        LoginAttemptId that = (LoginAttemptId) o;
        return Objects.equals(attemptId, that.attemptId) && Objects.equals(tenantId, that.tenantId);
    }

    @Override
    public int hashCode() {
        return Objects.hash(attemptId, tenantId);
    }
}
