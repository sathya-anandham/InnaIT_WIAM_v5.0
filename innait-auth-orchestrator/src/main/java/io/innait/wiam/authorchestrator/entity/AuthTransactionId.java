package io.innait.wiam.authorchestrator.entity;

import java.io.Serializable;
import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

public class AuthTransactionId implements Serializable {

    private UUID authTxnId;
    private Instant startedAt;

    public AuthTransactionId() {
    }

    public AuthTransactionId(UUID authTxnId, Instant startedAt) {
        this.authTxnId = authTxnId;
        this.startedAt = startedAt;
    }

    public UUID getAuthTxnId() { return authTxnId; }
    public void setAuthTxnId(UUID authTxnId) { this.authTxnId = authTxnId; }

    public Instant getStartedAt() { return startedAt; }
    public void setStartedAt(Instant startedAt) { this.startedAt = startedAt; }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        AuthTransactionId that = (AuthTransactionId) o;
        return Objects.equals(authTxnId, that.authTxnId) && Objects.equals(startedAt, that.startedAt);
    }

    @Override
    public int hashCode() {
        return Objects.hash(authTxnId, startedAt);
    }
}
