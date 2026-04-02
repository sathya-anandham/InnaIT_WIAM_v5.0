package io.innait.wiam.auditservice.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import io.innait.wiam.auditservice.dto.AdminActionRequest;
import io.innait.wiam.auditservice.entity.*;
import io.innait.wiam.auditservice.repository.AuditEventRepository;
import io.innait.wiam.auditservice.repository.SecurityIncidentRepository;
import io.innait.wiam.auditservice.service.AuditEventConsumer;
import io.innait.wiam.common.context.TenantContext;
import io.innait.wiam.common.security.JwtAuthenticationFilter;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc(addFilters = false)
@ActiveProfiles("test")
class AuditControllerIntegrationTest {

    @MockBean private JwtAuthenticationFilter jwtAuthenticationFilter;
    @MockBean private StringRedisTemplate redisTemplate;

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;
    @Autowired private AuditEventRepository auditEventRepository;
    @Autowired private SecurityIncidentRepository securityIncidentRepository;

    private static final UUID TENANT_ID = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        TenantContext.setTenantId(TENANT_ID);
    }

    @AfterEach
    void tearDown() {
        TenantContext.clear();
    }

    // ──────────────────────────── Audit Events ────────────────────────────

    @Nested
    @WithMockUser(roles = "SUPER_ADMIN")
    class AuditEventEndpoints {

        @Test
        void shouldQueryAuditEvents() throws Exception {
            // Seed an audit event
            UUID correlationId = UUID.randomUUID();
            AuditEvent event = new AuditEvent(
                    UUID.randomUUID(), TENANT_ID, correlationId,
                    "user.created", EventCategory.USER_MANAGEMENT,
                    UUID.randomUUID(), "USER", "10.0.0.1",
                    UUID.randomUUID(), "USER", "USER", UUID.randomUUID(),
                    "CREATE", AuditOutcome.SUCCESS,
                    "{\"action\": \"create\"}", "identity",
                    Instant.now());
            auditEventRepository.save(event);

            mockMvc.perform(get("/api/v1/audit/events")
                            .param("category", "USER_MANAGEMENT")
                            .param("page", "0")
                            .param("size", "10"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.data.content").isArray())
                    .andExpect(jsonPath("$.data.content", hasSize(greaterThanOrEqualTo(1))))
                    .andExpect(jsonPath("$.data.content[0].eventCategory").value("USER_MANAGEMENT"));
        }

        @Test
        void shouldFilterByTimeRange() throws Exception {
            Instant now = Instant.now();
            AuditEvent event = new AuditEvent(
                    UUID.randomUUID(), TENANT_ID, null,
                    "auth.succeeded", EventCategory.AUTHENTICATION,
                    null, null, null, null, null, null, null,
                    "COMPLETE", AuditOutcome.SUCCESS, null, "authn", now);
            auditEventRepository.save(event);

            mockMvc.perform(get("/api/v1/audit/events")
                            .param("fromTime", now.minusSeconds(60).toString())
                            .param("toTime", now.plusSeconds(60).toString())
                            .param("page", "0")
                            .param("size", "10"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.data.content", hasSize(greaterThanOrEqualTo(1))));
        }

        @Test
        void shouldTraceByCorrelationId() throws Exception {
            UUID correlationId = UUID.randomUUID();
            Instant now = Instant.now();

            // Two events with same correlation ID
            auditEventRepository.save(new AuditEvent(
                    UUID.randomUUID(), TENANT_ID, correlationId,
                    "auth.started", EventCategory.AUTHENTICATION,
                    null, null, null, null, null, null, null,
                    "INITIATE", AuditOutcome.SUCCESS, null, "authn", now.minusSeconds(2)));
            auditEventRepository.save(new AuditEvent(
                    UUID.randomUUID(), TENANT_ID, correlationId,
                    "auth.succeeded", EventCategory.AUTHENTICATION,
                    null, null, null, null, null, null, null,
                    "COMPLETE", AuditOutcome.SUCCESS, null, "authn", now));

            mockMvc.perform(get("/api/v1/audit/events/trace/{correlationId}", correlationId))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.data", hasSize(2)))
                    .andExpect(jsonPath("$.data[0].eventType").value("auth.started"))
                    .andExpect(jsonPath("$.data[1].eventType").value("auth.succeeded"));
        }
    }

    // ──────────────────────────── Admin Actions ────────────────────────────

    @Nested
    @WithMockUser(roles = "SUPER_ADMIN")
    class AdminActionEndpoints {

        @Test
        void shouldLogAndQueryAdminAction() throws Exception {
            UUID adminId = UUID.randomUUID();
            UUID targetId = UUID.randomUUID();

            AdminActionRequest request = new AdminActionRequest(
                    adminId, "UPDATE", "USER", targetId,
                    Map.of("status", "ACTIVE"),
                    Map.of("status", "SUSPENDED"),
                    "Policy violation");

            // Log
            mockMvc.perform(post("/api/v1/audit/admin-actions")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.data.actionType").value("UPDATE"))
                    .andExpect(jsonPath("$.data.targetType").value("USER"))
                    .andExpect(jsonPath("$.data.justification").value("Policy violation"));

            // Query
            mockMvc.perform(get("/api/v1/audit/admin-actions")
                            .param("targetType", "USER")
                            .param("targetId", targetId.toString())
                            .param("page", "0")
                            .param("size", "10"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.data.content", hasSize(greaterThanOrEqualTo(1))));
        }

        @Test
        void shouldStoreBeforeAndAfterState() throws Exception {
            AdminActionRequest request = new AdminActionRequest(
                    UUID.randomUUID(), "UPDATE", "ROLE", UUID.randomUUID(),
                    Map.of("name", "old_name", "description", "old_desc"),
                    Map.of("name", "new_name", "description", "new_desc"),
                    null);

            mockMvc.perform(post("/api/v1/audit/admin-actions")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.data.beforeState").isNotEmpty())
                    .andExpect(jsonPath("$.data.afterState").isNotEmpty());
        }
    }

    // ──────────────────────────── Security Incidents ────────────────────────────

    @Nested
    @WithMockUser(roles = "SUPER_ADMIN")
    class SecurityIncidentEndpoints {

        @Test
        void shouldQuerySecurityIncidents() throws Exception {
            SecurityIncident incident = new SecurityIncident(
                    UUID.randomUUID(), TENANT_ID, IncidentType.BRUTE_FORCE,
                    IncidentSeverity.HIGH, "192.168.1.1", UUID.randomUUID(),
                    "Brute force attack detected", "{\"count\": 15}",
                    IncidentStatus.OPEN, Instant.now());
            securityIncidentRepository.save(incident);

            mockMvc.perform(get("/api/v1/audit/security-incidents")
                            .param("severity", "HIGH")
                            .param("status", "OPEN")
                            .param("page", "0")
                            .param("size", "10"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.data.content", hasSize(greaterThanOrEqualTo(1))))
                    .andExpect(jsonPath("$.data.content[0].incidentType").value("BRUTE_FORCE"))
                    .andExpect(jsonPath("$.data.content[0].severity").value("HIGH"));
        }

        @Test
        void shouldFilterBySeverity() throws Exception {
            securityIncidentRepository.save(new SecurityIncident(
                    UUID.randomUUID(), TENANT_ID, IncidentType.CREDENTIAL_STUFFING,
                    IncidentSeverity.CRITICAL, "10.0.0.1", null,
                    "Credential stuffing", null, IncidentStatus.OPEN, Instant.now()));

            securityIncidentRepository.save(new SecurityIncident(
                    UUID.randomUUID(), TENANT_ID, IncidentType.IMPOSSIBLE_TRAVEL,
                    IncidentSeverity.MEDIUM, "10.0.0.2", UUID.randomUUID(),
                    "Travel anomaly", null, IncidentStatus.INVESTIGATING, Instant.now()));

            mockMvc.perform(get("/api/v1/audit/security-incidents")
                            .param("severity", "CRITICAL")
                            .param("page", "0")
                            .param("size", "10"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.data.content[0].severity").value("CRITICAL"));
        }
    }

    // ──────────────────────────── End-to-End ────────────────────────────

    @Nested
    @WithMockUser(roles = "SUPER_ADMIN")
    class EndToEnd {

        @Test
        void shouldPersistAndRetrieveFullAuditTrail() throws Exception {
            UUID correlationId = UUID.randomUUID();
            UUID actorId = UUID.randomUUID();
            UUID subjectId = UUID.randomUUID();
            Instant now = Instant.now();

            // Persist multiple correlated events
            auditEventRepository.save(new AuditEvent(
                    UUID.randomUUID(), TENANT_ID, correlationId,
                    "auth.started", EventCategory.AUTHENTICATION,
                    actorId, "USER", "10.0.0.1",
                    subjectId, "ACCOUNT", null, null,
                    "INITIATE", AuditOutcome.SUCCESS, null, "authn", now.minusSeconds(3)));
            auditEventRepository.save(new AuditEvent(
                    UUID.randomUUID(), TENANT_ID, correlationId,
                    "credential.verified", EventCategory.CREDENTIAL,
                    actorId, "USER", "10.0.0.1",
                    subjectId, "ACCOUNT", null, null,
                    "COMPLETE", AuditOutcome.SUCCESS, null, "credential", now.minusSeconds(2)));
            auditEventRepository.save(new AuditEvent(
                    UUID.randomUUID(), TENANT_ID, correlationId,
                    "session.created", EventCategory.SESSION,
                    actorId, "USER", "10.0.0.1",
                    subjectId, "ACCOUNT", null, null,
                    "CREATE", AuditOutcome.SUCCESS, null, "session", now));

            // Trace the full flow by correlation ID
            mockMvc.perform(get("/api/v1/audit/events/trace/{correlationId}", correlationId))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.data", hasSize(3)))
                    .andExpect(jsonPath("$.data[0].eventType").value("auth.started"))
                    .andExpect(jsonPath("$.data[1].eventType").value("credential.verified"))
                    .andExpect(jsonPath("$.data[2].eventType").value("session.created"));

            // Query by actor
            mockMvc.perform(get("/api/v1/audit/events")
                            .param("actorId", actorId.toString())
                            .param("page", "0")
                            .param("size", "10"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.data.content", hasSize(greaterThanOrEqualTo(3))));
        }
    }
}
