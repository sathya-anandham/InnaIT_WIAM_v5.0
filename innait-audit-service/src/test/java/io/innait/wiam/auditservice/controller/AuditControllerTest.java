package io.innait.wiam.auditservice.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import io.innait.wiam.auditservice.dto.AdminActionRequest;
import io.innait.wiam.auditservice.dto.AdminActionResponse;
import io.innait.wiam.auditservice.dto.AuditEventResponse;
import io.innait.wiam.auditservice.dto.SecurityIncidentResponse;
import io.innait.wiam.auditservice.entity.*;
import io.innait.wiam.auditservice.service.AdminActionLogger;
import io.innait.wiam.auditservice.service.AuditQueryService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.hamcrest.Matchers.hasSize;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(AuditController.class)
@AutoConfigureMockMvc(addFilters = false)
class AuditControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private AuditQueryService queryService;

    @MockBean
    private AdminActionLogger adminActionLogger;

    private static final String BASE_PATH = "/api/v1/audit";

    // ---- Audit Events ----

    @Nested
    @DisplayName("GET /events")
    class QueryAuditEvents {

        @Test
        @DisplayName("should query audit events with no filters")
        void shouldQueryAuditEvents() throws Exception {
            UUID eventId = UUID.randomUUID();
            UUID tenantId = UUID.randomUUID();
            UUID correlationId = UUID.randomUUID();
            UUID actorId = UUID.randomUUID();

            AuditEventResponse event = new AuditEventResponse(
                    eventId, tenantId, correlationId,
                    "USER_LOGIN", EventCategory.AUTHENTICATION,
                    actorId, "USER", "192.168.1.1",
                    actorId, "ACCOUNT",
                    "SESSION", UUID.randomUUID(),
                    "LOGIN", AuditOutcome.SUCCESS, "Login from Chrome",
                    "auth-orchestrator", Instant.now());

            Page<AuditEventResponse> page = new PageImpl<>(List.of(event), PageRequest.of(0, 20), 1);

            when(queryService.queryAuditEvents(
                    isNull(), isNull(), isNull(), isNull(),
                    isNull(), isNull(), any(Pageable.class)))
                    .thenReturn(page);

            mockMvc.perform(get(BASE_PATH + "/events")
                            .param("page", "0")
                            .param("size", "20"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.status").value("SUCCESS"))
                    .andExpect(jsonPath("$.data.content", hasSize(1)))
                    .andExpect(jsonPath("$.data.content[0].eventType").value("USER_LOGIN"))
                    .andExpect(jsonPath("$.data.content[0].eventCategory").value("AUTHENTICATION"))
                    .andExpect(jsonPath("$.data.content[0].actorIp").value("192.168.1.1"));

            verify(queryService).queryAuditEvents(
                    isNull(), isNull(), isNull(), isNull(),
                    isNull(), isNull(), any(Pageable.class));
        }

        @Test
        @DisplayName("should query audit events with category filter")
        void shouldQueryAuditEventsWithCategoryFilter() throws Exception {
            Page<AuditEventResponse> page = new PageImpl<>(List.of(), PageRequest.of(0, 20), 0);

            when(queryService.queryAuditEvents(
                    eq(EventCategory.SECURITY), isNull(), isNull(), isNull(),
                    isNull(), isNull(), any(Pageable.class)))
                    .thenReturn(page);

            mockMvc.perform(get(BASE_PATH + "/events")
                            .param("category", "SECURITY")
                            .param("page", "0")
                            .param("size", "20"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.status").value("SUCCESS"))
                    .andExpect(jsonPath("$.data.content", hasSize(0)));

            verify(queryService).queryAuditEvents(
                    eq(EventCategory.SECURITY), isNull(), isNull(), isNull(),
                    isNull(), isNull(), any(Pageable.class));
        }
    }

    // ---- Trace by Correlation ID ----

    @Nested
    @DisplayName("GET /events/trace/{correlationId}")
    class TraceByCorrelationId {

        @Test
        @DisplayName("should trace events by correlationId")
        void shouldTraceByCorrelationId() throws Exception {
            UUID correlationId = UUID.randomUUID();
            UUID tenantId = UUID.randomUUID();

            AuditEventResponse event1 = new AuditEventResponse(
                    UUID.randomUUID(), tenantId, correlationId,
                    "AUTH_START", EventCategory.AUTHENTICATION,
                    UUID.randomUUID(), "USER", "10.0.0.1",
                    UUID.randomUUID(), "ACCOUNT",
                    "SESSION", UUID.randomUUID(),
                    "AUTHENTICATE", AuditOutcome.SUCCESS, "Step 1",
                    "auth-orchestrator", Instant.now().minusSeconds(10));

            AuditEventResponse event2 = new AuditEventResponse(
                    UUID.randomUUID(), tenantId, correlationId,
                    "MFA_VERIFY", EventCategory.AUTHENTICATION,
                    UUID.randomUUID(), "USER", "10.0.0.1",
                    UUID.randomUUID(), "ACCOUNT",
                    "CREDENTIAL", UUID.randomUUID(),
                    "VERIFY_MFA", AuditOutcome.SUCCESS, "Step 2",
                    "credential-service", Instant.now());

            when(queryService.traceByCorrelationId(correlationId))
                    .thenReturn(List.of(event1, event2));

            mockMvc.perform(get(BASE_PATH + "/events/trace/{correlationId}", correlationId))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.status").value("SUCCESS"))
                    .andExpect(jsonPath("$.data", hasSize(2)))
                    .andExpect(jsonPath("$.data[0].eventType").value("AUTH_START"))
                    .andExpect(jsonPath("$.data[1].eventType").value("MFA_VERIFY"));

            verify(queryService).traceByCorrelationId(correlationId);
        }
    }

    // ---- Admin Actions ----

    @Nested
    @DisplayName("Admin Actions")
    class AdminActions {

        @Test
        @DisplayName("GET /admin-actions - should query admin actions")
        void shouldQueryAdminActions() throws Exception {
            UUID actionId = UUID.randomUUID();
            UUID tenantId = UUID.randomUUID();
            UUID adminId = UUID.randomUUID();
            UUID targetId = UUID.randomUUID();

            AdminActionResponse action = new AdminActionResponse(
                    actionId, tenantId, adminId,
                    "UPDATE_USER", "USER", targetId,
                    "{\"status\":\"ACTIVE\"}", "{\"status\":\"SUSPENDED\"}",
                    "Policy violation", Instant.now());

            Page<AdminActionResponse> page = new PageImpl<>(List.of(action), PageRequest.of(0, 20), 1);

            when(queryService.queryAdminActions(isNull(), isNull(), any(Pageable.class)))
                    .thenReturn(page);

            mockMvc.perform(get(BASE_PATH + "/admin-actions")
                            .param("page", "0")
                            .param("size", "20"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.status").value("SUCCESS"))
                    .andExpect(jsonPath("$.data.content", hasSize(1)))
                    .andExpect(jsonPath("$.data.content[0].actionType").value("UPDATE_USER"))
                    .andExpect(jsonPath("$.data.content[0].targetType").value("USER"));

            verify(queryService).queryAdminActions(isNull(), isNull(), any(Pageable.class));
        }

        @Test
        @DisplayName("POST /admin-actions - should log an admin action")
        void shouldLogAdminAction() throws Exception {
            UUID adminId = UUID.randomUUID();
            UUID targetId = UUID.randomUUID();
            UUID actionId = UUID.randomUUID();
            UUID tenantId = UUID.randomUUID();

            AdminActionRequest request = new AdminActionRequest(
                    adminId, "DISABLE_ACCOUNT", "ACCOUNT", targetId,
                    Map.of("status", "ACTIVE"),
                    Map.of("status", "DISABLED"),
                    "Security review");

            AdminActionResponse response = new AdminActionResponse(
                    actionId, tenantId, adminId,
                    "DISABLE_ACCOUNT", "ACCOUNT", targetId,
                    "{\"status\":\"ACTIVE\"}", "{\"status\":\"DISABLED\"}",
                    "Security review", Instant.now());

            when(adminActionLogger.logAction(any(AdminActionRequest.class)))
                    .thenReturn(response);

            mockMvc.perform(post(BASE_PATH + "/admin-actions")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.status").value("SUCCESS"))
                    .andExpect(jsonPath("$.data.adminActionId").value(actionId.toString()))
                    .andExpect(jsonPath("$.data.actionType").value("DISABLE_ACCOUNT"))
                    .andExpect(jsonPath("$.data.justification").value("Security review"));

            verify(adminActionLogger).logAction(any(AdminActionRequest.class));
        }
    }

    // ---- Security Incidents ----

    @Nested
    @DisplayName("GET /security-incidents")
    class QuerySecurityIncidents {

        @Test
        @DisplayName("should query security incidents")
        void shouldQuerySecurityIncidents() throws Exception {
            UUID incidentId = UUID.randomUUID();
            UUID tenantId = UUID.randomUUID();
            UUID accountId = UUID.randomUUID();

            SecurityIncidentResponse incident = new SecurityIncidentResponse(
                    incidentId, tenantId, IncidentType.BRUTE_FORCE,
                    IncidentSeverity.HIGH, "203.0.113.50", accountId,
                    "Multiple failed login attempts detected",
                    "15 failed attempts in 5 minutes",
                    IncidentStatus.OPEN, null, null, Instant.now());

            Page<SecurityIncidentResponse> page = new PageImpl<>(
                    List.of(incident), PageRequest.of(0, 20), 1);

            when(queryService.querySecurityIncidents(isNull(), isNull(), any(Pageable.class)))
                    .thenReturn(page);

            mockMvc.perform(get(BASE_PATH + "/security-incidents")
                            .param("page", "0")
                            .param("size", "20"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.status").value("SUCCESS"))
                    .andExpect(jsonPath("$.data.content", hasSize(1)))
                    .andExpect(jsonPath("$.data.content[0].incidentType").value("BRUTE_FORCE"))
                    .andExpect(jsonPath("$.data.content[0].severity").value("HIGH"))
                    .andExpect(jsonPath("$.data.content[0].status").value("OPEN"))
                    .andExpect(jsonPath("$.data.content[0].sourceIp").value("203.0.113.50"));

            verify(queryService).querySecurityIncidents(isNull(), isNull(), any(Pageable.class));
        }

        @Test
        @DisplayName("should query security incidents with severity and status filters")
        void shouldQuerySecurityIncidentsWithFilters() throws Exception {
            Page<SecurityIncidentResponse> page = new PageImpl<>(
                    List.of(), PageRequest.of(0, 20), 0);

            when(queryService.querySecurityIncidents(
                    eq(IncidentSeverity.CRITICAL), eq(IncidentStatus.OPEN), any(Pageable.class)))
                    .thenReturn(page);

            mockMvc.perform(get(BASE_PATH + "/security-incidents")
                            .param("severity", "CRITICAL")
                            .param("status", "OPEN")
                            .param("page", "0")
                            .param("size", "20"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.status").value("SUCCESS"))
                    .andExpect(jsonPath("$.data.content", hasSize(0)));

            verify(queryService).querySecurityIncidents(
                    eq(IncidentSeverity.CRITICAL), eq(IncidentStatus.OPEN), any(Pageable.class));
        }
    }

    // ---- Response Envelope ----

    @Nested
    @DisplayName("Response envelope verification")
    class ResponseEnvelope {

        @Test
        @DisplayName("should always wrap response in ApiResponse envelope with SUCCESS status")
        void shouldWrapInApiResponseEnvelope() throws Exception {
            UUID correlationId = UUID.randomUUID();
            when(queryService.traceByCorrelationId(correlationId)).thenReturn(List.of());

            mockMvc.perform(get(BASE_PATH + "/events/trace/{correlationId}", correlationId))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.status").value("SUCCESS"))
                    .andExpect(jsonPath("$.data").isArray())
                    .andExpect(jsonPath("$.data", hasSize(0)));
        }
    }
}
