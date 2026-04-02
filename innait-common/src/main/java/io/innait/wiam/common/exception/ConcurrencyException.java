package io.innait.wiam.common.exception;

public class ConcurrencyException extends RuntimeException {

    private final String entityType;
    private final String entityId;

    public ConcurrencyException(String entityType, String entityId) {
        super(String.format("Concurrent modification detected for %s: %s", entityType, entityId));
        this.entityType = entityType;
        this.entityId = entityId;
    }

    public String getEntityType() {
        return entityType;
    }

    public String getEntityId() {
        return entityId;
    }
}
