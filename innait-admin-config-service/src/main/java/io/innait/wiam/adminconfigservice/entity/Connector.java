package io.innait.wiam.adminconfigservice.entity;

import io.innait.wiam.common.entity.BaseEntity;
import jakarta.persistence.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;

@Entity
@Table(name = "CONNECTORS")
@AttributeOverride(name = "id", column = @Column(name = "CONNECTOR_ID", columnDefinition = "RAW(16)"))
public class Connector extends BaseEntity {

    @Column(name = "CONNECTOR_NAME", nullable = false, length = 255)
    private String connectorName;

    @Enumerated(EnumType.STRING)
    @Column(name = "CONNECTOR_TYPE", nullable = false, length = 30)
    private ConnectorType connectorType;

    @JdbcTypeCode(SqlTypes.CLOB)
    @Column(name = "ENCRYPTED_CONFIG", nullable = false)
    private String encryptedConfig;

    @Enumerated(EnumType.STRING)
    @Column(name = "STATUS", nullable = false, length = 20)
    private ConnectorStatus status = ConnectorStatus.CONFIGURING;

    @Column(name = "LAST_SYNC_AT")
    private Instant lastSyncAt;

    @Column(name = "LAST_SYNC_STATUS", length = 20)
    private String lastSyncStatus;

    protected Connector() {}

    public Connector(String connectorName, ConnectorType connectorType, String encryptedConfig) {
        this.connectorName = connectorName;
        this.connectorType = connectorType;
        this.encryptedConfig = encryptedConfig;
    }

    // Getters
    public String getConnectorName() { return connectorName; }
    public ConnectorType getConnectorType() { return connectorType; }
    public String getEncryptedConfig() { return encryptedConfig; }
    public ConnectorStatus getStatus() { return status; }
    public Instant getLastSyncAt() { return lastSyncAt; }
    public String getLastSyncStatus() { return lastSyncStatus; }

    // Setters
    public void setConnectorName(String connectorName) { this.connectorName = connectorName; }
    public void setEncryptedConfig(String encryptedConfig) { this.encryptedConfig = encryptedConfig; }
    public void setStatus(ConnectorStatus status) { this.status = status; }
    public void setLastSyncAt(Instant lastSyncAt) { this.lastSyncAt = lastSyncAt; }
    public void setLastSyncStatus(String lastSyncStatus) { this.lastSyncStatus = lastSyncStatus; }

    public void recordSync(String syncStatus) {
        this.lastSyncAt = Instant.now();
        this.lastSyncStatus = syncStatus;
    }
}
