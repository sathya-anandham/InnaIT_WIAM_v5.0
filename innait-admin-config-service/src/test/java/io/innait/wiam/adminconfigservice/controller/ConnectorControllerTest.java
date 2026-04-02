package io.innait.wiam.adminconfigservice.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import io.innait.wiam.adminconfigservice.dto.*;
import io.innait.wiam.adminconfigservice.entity.ConnectorStatus;
import io.innait.wiam.adminconfigservice.entity.ConnectorType;
import io.innait.wiam.adminconfigservice.service.ConnectorService;
import io.innait.wiam.common.context.TenantContext;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.hamcrest.Matchers.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(ConnectorController.class)
@AutoConfigureMockMvc(addFilters = false)
class ConnectorControllerTest {

    private static final String BASE_URL = "/api/v1/admin/connectors";
    private static final UUID TENANT_ID = UUID.fromString("00000000-0000-0000-0000-000000000001");

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private ConnectorService connectorService;

    @BeforeEach
    void setUp() {
        TenantContext.setTenantId(TENANT_ID);
    }

    @AfterEach
    void tearDown() {
        TenantContext.clear();
    }

    // ----- helpers -----

    private ConnectorResponse sampleConnectorResponse(UUID connectorId) {
        return new ConnectorResponse(
                connectorId, TENANT_ID, "LDAP Prod", ConnectorType.LDAP,
                ConnectorStatus.CONFIGURING, null, null);
    }

    // ----- create connector -----

    @Test
    void createConnector_shouldReturn200WithConnectorResponse() throws Exception {
        UUID connectorId = UUID.randomUUID();
        ConnectorResponse response = sampleConnectorResponse(connectorId);

        when(connectorService.createConnector(eq(TENANT_ID), any(CreateConnectorRequest.class)))
                .thenReturn(response);

        CreateConnectorRequest request = new CreateConnectorRequest(
                "LDAP Prod", ConnectorType.LDAP,
                Map.of("url", "ldap://ldap.acme.com:389",
                        "bindDn", "cn=admin,dc=acme",
                        "bindPassword", "s3cr3t"));

        mockMvc.perform(post(BASE_URL)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("SUCCESS"))
                .andExpect(jsonPath("$.data.connectorId").value(connectorId.toString()))
                .andExpect(jsonPath("$.data.connectorName").value("LDAP Prod"))
                .andExpect(jsonPath("$.data.connectorType").value("LDAP"))
                .andExpect(jsonPath("$.data.status").value("CONFIGURING"));

        verify(connectorService).createConnector(eq(TENANT_ID), any(CreateConnectorRequest.class));
    }

    // ----- update connector -----

    @Test
    void updateConnector_shouldReturn200WithUpdatedConnector() throws Exception {
        UUID connectorId = UUID.randomUUID();
        ConnectorResponse response = new ConnectorResponse(
                connectorId, TENANT_ID, "LDAP Updated", ConnectorType.LDAP,
                ConnectorStatus.ACTIVE, Instant.parse("2026-03-01T00:00:00Z"), "SUCCESS");

        when(connectorService.updateConnector(eq(TENANT_ID), eq(connectorId), any(UpdateConnectorRequest.class)))
                .thenReturn(response);

        UpdateConnectorRequest request = new UpdateConnectorRequest(
                "LDAP Updated", ConnectorStatus.ACTIVE, null);

        mockMvc.perform(put(BASE_URL + "/" + connectorId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("SUCCESS"))
                .andExpect(jsonPath("$.data.connectorName").value("LDAP Updated"))
                .andExpect(jsonPath("$.data.status").value("ACTIVE"));

        verify(connectorService).updateConnector(eq(TENANT_ID), eq(connectorId), any(UpdateConnectorRequest.class));
    }

    // ----- get connector -----

    @Test
    void getConnector_shouldReturn200WithConnectorData() throws Exception {
        UUID connectorId = UUID.randomUUID();
        ConnectorResponse response = sampleConnectorResponse(connectorId);

        when(connectorService.getConnector(connectorId)).thenReturn(response);

        mockMvc.perform(get(BASE_URL + "/" + connectorId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("SUCCESS"))
                .andExpect(jsonPath("$.data.connectorId").value(connectorId.toString()))
                .andExpect(jsonPath("$.data.connectorName").value("LDAP Prod"))
                .andExpect(jsonPath("$.data.tenantId").value(TENANT_ID.toString()));

        verify(connectorService).getConnector(connectorId);
    }

    // ----- list connectors -----

    @Test
    void listConnectors_shouldReturn200WithListOfConnectors() throws Exception {
        UUID id1 = UUID.randomUUID();
        UUID id2 = UUID.randomUUID();

        List<ConnectorResponse> connectors = List.of(
                new ConnectorResponse(id1, TENANT_ID, "LDAP Prod", ConnectorType.LDAP,
                        ConnectorStatus.ACTIVE, Instant.parse("2026-03-01T00:00:00Z"), "SUCCESS"),
                new ConnectorResponse(id2, TENANT_ID, "Azure AD", ConnectorType.AZURE_AD,
                        ConnectorStatus.CONFIGURING, null, null)
        );

        when(connectorService.listConnectors(TENANT_ID)).thenReturn(connectors);

        mockMvc.perform(get(BASE_URL))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("SUCCESS"))
                .andExpect(jsonPath("$.data", hasSize(2)))
                .andExpect(jsonPath("$.data[0].connectorName").value("LDAP Prod"))
                .andExpect(jsonPath("$.data[0].connectorType").value("LDAP"))
                .andExpect(jsonPath("$.data[1].connectorName").value("Azure AD"))
                .andExpect(jsonPath("$.data[1].connectorType").value("AZURE_AD"));

        verify(connectorService).listConnectors(TENANT_ID);
    }

    // ----- delete connector -----

    @Test
    void deleteConnector_shouldReturn200WithNullData() throws Exception {
        UUID connectorId = UUID.randomUUID();

        mockMvc.perform(delete(BASE_URL + "/" + connectorId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("SUCCESS"))
                .andExpect(jsonPath("$.data").doesNotExist());

        verify(connectorService).deleteConnector(connectorId);
    }

    // ----- test connector -----

    @Test
    void testConnector_shouldReturn200WithSuccessResult() throws Exception {
        UUID connectorId = UUID.randomUUID();
        ConnectorTestResult result = new ConnectorTestResult(true, "Connection successful", 42L);

        when(connectorService.testConnector(connectorId)).thenReturn(result);

        mockMvc.perform(post(BASE_URL + "/" + connectorId + "/test"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("SUCCESS"))
                .andExpect(jsonPath("$.data.success").value(true))
                .andExpect(jsonPath("$.data.message").value("Connection successful"))
                .andExpect(jsonPath("$.data.latencyMs").value(42));

        verify(connectorService).testConnector(connectorId);
    }

    @Test
    void testConnector_shouldReturn200WithFailureResult() throws Exception {
        UUID connectorId = UUID.randomUUID();
        ConnectorTestResult result = new ConnectorTestResult(false, "Connection refused", 1500L);

        when(connectorService.testConnector(connectorId)).thenReturn(result);

        mockMvc.perform(post(BASE_URL + "/" + connectorId + "/test"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.success").value(false))
                .andExpect(jsonPath("$.data.message").value("Connection refused"))
                .andExpect(jsonPath("$.data.latencyMs").value(1500));
    }

    // ----- response format -----

    @Test
    void responseEnvelope_shouldAlwaysContainStatusAndDataKeys() throws Exception {
        when(connectorService.listConnectors(TENANT_ID)).thenReturn(List.of());

        mockMvc.perform(get(BASE_URL))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("SUCCESS"))
                .andExpect(jsonPath("$.data").isArray())
                .andExpect(jsonPath("$.error").doesNotExist());
    }
}
