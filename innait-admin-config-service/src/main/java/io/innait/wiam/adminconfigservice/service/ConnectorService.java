package io.innait.wiam.adminconfigservice.service;

import io.innait.wiam.adminconfigservice.dto.*;
import io.innait.wiam.adminconfigservice.entity.Connector;
import io.innait.wiam.adminconfigservice.entity.ConnectorStatus;
import io.innait.wiam.adminconfigservice.entity.ConnectorType;
import io.innait.wiam.adminconfigservice.repository.ConnectorRepository;
import io.innait.wiam.common.context.TenantContext;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import javax.naming.Context;
import javax.naming.directory.DirContext;
import javax.naming.directory.InitialDirContext;
import java.util.Hashtable;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class ConnectorService {

    private static final Logger log = LoggerFactory.getLogger(ConnectorService.class);

    private final ConnectorRepository repository;
    private final ConfigEncryptionService encryptionService;

    public ConnectorService(ConnectorRepository repository,
                            ConfigEncryptionService encryptionService) {
        this.repository = repository;
        this.encryptionService = encryptionService;
    }

    @Transactional
    public ConnectorResponse createConnector(UUID tenantId, CreateConnectorRequest request) {
        TenantContext.setTenantId(tenantId);
        String encrypted = encryptionService.encrypt(request.config());
        Connector connector = new Connector(request.connectorName(),
                request.connectorType(), encrypted);
        repository.save(connector);
        log.info("Created connector [{}] type=[{}] for tenant [{}]",
                connector.getConnectorName(), request.connectorType(), tenantId);
        return toResponse(connector);
    }

    @Transactional
    public ConnectorResponse updateConnector(UUID tenantId, UUID connectorId,
                                             UpdateConnectorRequest request) {
        Connector connector = repository.findById(connectorId)
                .orElseThrow(() -> new IllegalArgumentException("Connector not found: " + connectorId));

        TenantContext.setTenantId(tenantId);
        if (request.connectorName() != null) connector.setConnectorName(request.connectorName());
        if (request.status() != null) connector.setStatus(request.status());
        if (request.config() != null) {
            connector.setEncryptedConfig(encryptionService.encrypt(request.config()));
        }
        repository.save(connector);
        return toResponse(connector);
    }

    @Transactional(readOnly = true)
    public ConnectorResponse getConnector(UUID connectorId) {
        Connector connector = repository.findById(connectorId)
                .orElseThrow(() -> new IllegalArgumentException("Connector not found: " + connectorId));
        return toResponse(connector);
    }

    @Transactional(readOnly = true)
    public List<ConnectorResponse> listConnectors(UUID tenantId) {
        return repository.findByTenantId(tenantId).stream()
                .map(this::toResponse).toList();
    }

    @Transactional
    public void deleteConnector(UUID connectorId) {
        Connector connector = repository.findById(connectorId)
                .orElseThrow(() -> new IllegalArgumentException("Connector not found: " + connectorId));
        repository.delete(connector);
    }

    /**
     * Test a connector by attempting to connect with its stored config.
     */
    @Transactional
    public ConnectorTestResult testConnector(UUID connectorId) {
        Connector connector = repository.findById(connectorId)
                .orElseThrow(() -> new IllegalArgumentException("Connector not found: " + connectorId));

        Map<String, Object> config = encryptionService.decrypt(connector.getEncryptedConfig());
        long start = System.currentTimeMillis();

        try {
            switch (connector.getConnectorType()) {
                case LDAP, ACTIVE_DIRECTORY -> testLdapConnection(config);
                default -> {
                    // For other types, just validate config presence
                    if (config.isEmpty()) {
                        throw new RuntimeException("Empty configuration");
                    }
                }
            }

            long latency = System.currentTimeMillis() - start;
            connector.setStatus(ConnectorStatus.ACTIVE);
            connector.recordSync("SUCCESS");
            repository.save(connector);

            return new ConnectorTestResult(true, "Connection successful", latency);
        } catch (Exception e) {
            long latency = System.currentTimeMillis() - start;
            connector.setStatus(ConnectorStatus.ERROR);
            connector.recordSync("FAILED: " + e.getMessage());
            repository.save(connector);

            return new ConnectorTestResult(false, e.getMessage(), latency);
        }
    }

    /**
     * Decrypt and return config (admin only).
     */
    @Transactional(readOnly = true)
    public Map<String, Object> getDecryptedConfig(UUID connectorId) {
        Connector connector = repository.findById(connectorId)
                .orElseThrow(() -> new IllegalArgumentException("Connector not found: " + connectorId));
        return encryptionService.decrypt(connector.getEncryptedConfig());
    }

    private void testLdapConnection(Map<String, Object> config) throws Exception {
        String url = (String) config.get("url");
        String bindDn = (String) config.get("bindDn");
        String bindPassword = (String) config.get("bindPassword");

        if (url == null) throw new RuntimeException("LDAP URL not configured");

        Hashtable<String, String> env = new Hashtable<>();
        env.put(Context.INITIAL_CONTEXT_FACTORY, "com.sun.jndi.ldap.LdapCtxFactory");
        env.put(Context.PROVIDER_URL, url);
        if (bindDn != null) {
            env.put(Context.SECURITY_AUTHENTICATION, "simple");
            env.put(Context.SECURITY_PRINCIPAL, bindDn);
            env.put(Context.SECURITY_CREDENTIALS, bindPassword != null ? bindPassword : "");
        }

        DirContext ctx = new InitialDirContext(env);
        ctx.close();
    }

    private ConnectorResponse toResponse(Connector c) {
        return new ConnectorResponse(c.getId(), c.getTenantId(), c.getConnectorName(),
                c.getConnectorType(), c.getStatus(), c.getLastSyncAt(), c.getLastSyncStatus());
    }
}
