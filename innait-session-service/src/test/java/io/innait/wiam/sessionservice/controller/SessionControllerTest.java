package io.innait.wiam.sessionservice.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import io.innait.wiam.sessionservice.dto.*;
import io.innait.wiam.sessionservice.service.SessionService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(SessionController.class)
@AutoConfigureMockMvc(addFilters = false)
class SessionControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private SessionService sessionService;

    private static final String BASE_URL = "/api/v1/sessions";

    // ──────────────────────────── POST / (create session) ────────────────────────────

    @Test
    @DisplayName("POST / - should create a session and return the session UUID")
    void createSession_shouldReturnSessionId() throws Exception {
        UUID accountId = UUID.randomUUID();
        UUID authTxnId = UUID.randomUUID();
        UUID sessionId = UUID.randomUUID();

        CreateSessionRequest request = new CreateSessionRequest(
                accountId, authTxnId,
                List.of("PASSWORD", "TOTP"), 2,
                "INTERACTIVE", "10.0.0.1", "Mozilla/5.0",
                "fp-abc123", "IN", "KA", "Bangalore");

        when(sessionService.createSession(any(CreateSessionRequest.class))).thenReturn(sessionId);

        mockMvc.perform(post(BASE_URL)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("SUCCESS"))
                .andExpect(jsonPath("$.data").value(sessionId.toString()));

        verify(sessionService).createSession(any(CreateSessionRequest.class));
    }

    // ──────────────────────────── GET /{sessionId} ────────────────────────────

    @Test
    @DisplayName("GET /{sessionId} - should return session details")
    void getSession_shouldReturnSessionResponse() throws Exception {
        UUID sessionId = UUID.randomUUID();
        UUID accountId = UUID.randomUUID();
        Instant now = Instant.now();

        SessionContextResponse context = new SessionContextResponse(
                "10.0.0.1", "Mozilla/5.0", "fp-abc123",
                "IN", "KA", "Bangalore", BigDecimal.valueOf(0.85));

        SessionResponse response = new SessionResponse(
                sessionId, accountId, "INTERACTIVE", "ACTIVE", 2,
                now.minusSeconds(3600), now.minusSeconds(60), now.plusSeconds(25200),
                null, null, context);

        when(sessionService.getSession(eq(sessionId))).thenReturn(response);

        mockMvc.perform(get(BASE_URL + "/{sessionId}", sessionId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("SUCCESS"))
                .andExpect(jsonPath("$.data.sessionId").value(sessionId.toString()))
                .andExpect(jsonPath("$.data.accountId").value(accountId.toString()))
                .andExpect(jsonPath("$.data.sessionType").value("INTERACTIVE"))
                .andExpect(jsonPath("$.data.sessionStatus").value("ACTIVE"))
                .andExpect(jsonPath("$.data.authLevel").value(2))
                .andExpect(jsonPath("$.data.context.ipAddress").value("10.0.0.1"))
                .andExpect(jsonPath("$.data.context.geoCity").value("Bangalore"));

        verify(sessionService).getSession(eq(sessionId));
    }

    // ──────────────────────────── DELETE /{sessionId} ────────────────────────────

    @Test
    @DisplayName("DELETE /{sessionId} - should revoke session with reason and revokedBy params")
    void revokeSession_shouldReturnSuccessVoid() throws Exception {
        UUID sessionId = UUID.randomUUID();

        doNothing().when(sessionService).revokeSession(eq(sessionId), eq("policy_violation"), eq("admin"));

        mockMvc.perform(delete(BASE_URL + "/{sessionId}", sessionId)
                        .param("reason", "policy_violation")
                        .param("revokedBy", "admin"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("SUCCESS"))
                .andExpect(jsonPath("$.data").doesNotExist());

        verify(sessionService).revokeSession(eq(sessionId), eq("policy_violation"), eq("admin"));
    }

    @Test
    @DisplayName("DELETE /{sessionId} - should use defaults when reason/revokedBy not provided")
    void revokeSession_withDefaults_shouldUseDefaultReason() throws Exception {
        UUID sessionId = UUID.randomUUID();

        doNothing().when(sessionService).revokeSession(eq(sessionId), eq("user_request"), eq("system"));

        mockMvc.perform(delete(BASE_URL + "/{sessionId}", sessionId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("SUCCESS"));

        verify(sessionService).revokeSession(eq(sessionId), eq("user_request"), eq("system"));
    }

    // ──────────────────────────── GET /account/{accountId} ────────────────────────────

    @Test
    @DisplayName("GET /account/{accountId} - should return list of active sessions")
    void listActiveSessions_shouldReturnSessionList() throws Exception {
        UUID accountId = UUID.randomUUID();
        UUID sessionId1 = UUID.randomUUID();
        UUID sessionId2 = UUID.randomUUID();
        Instant now = Instant.now();

        SessionResponse session1 = new SessionResponse(
                sessionId1, accountId, "INTERACTIVE", "ACTIVE", 2,
                now.minusSeconds(7200), now.minusSeconds(300), now.plusSeconds(21600),
                null, null, null);

        SessionResponse session2 = new SessionResponse(
                sessionId2, accountId, "API", "ACTIVE", 1,
                now.minusSeconds(1800), now.minusSeconds(60), now.plusSeconds(26400),
                null, null, null);

        when(sessionService.listActiveSessions(eq(accountId))).thenReturn(List.of(session1, session2));

        mockMvc.perform(get(BASE_URL + "/account/{accountId}", accountId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("SUCCESS"))
                .andExpect(jsonPath("$.data").isArray())
                .andExpect(jsonPath("$.data.length()").value(2))
                .andExpect(jsonPath("$.data[0].sessionId").value(sessionId1.toString()))
                .andExpect(jsonPath("$.data[1].sessionId").value(sessionId2.toString()));

        verify(sessionService).listActiveSessions(eq(accountId));
    }

    // ──────────────────────────── PATCH /{sessionId}/device-context ────────────────────────────

    @Test
    @DisplayName("PATCH /{sessionId}/device-context - should update device context")
    void updateDeviceContext_shouldReturnSuccessVoid() throws Exception {
        UUID sessionId = UUID.randomUUID();

        DeviceContextUpdateRequest request = new DeviceContextUpdateRequest(
                "fp-new-device-456", BigDecimal.valueOf(0.92),
                "US", "CA", "San Francisco");

        doNothing().when(sessionService).updateDeviceContext(eq(sessionId), any(DeviceContextUpdateRequest.class));

        mockMvc.perform(patch(BASE_URL + "/{sessionId}/device-context", sessionId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("SUCCESS"))
                .andExpect(jsonPath("$.data").doesNotExist());

        verify(sessionService).updateDeviceContext(eq(sessionId), any(DeviceContextUpdateRequest.class));
    }

    // ──────────────────────────── POST /{sessionId}/refresh ────────────────────────────

    @Test
    @DisplayName("POST /{sessionId}/refresh - should refresh session and return new refresh token")
    void refreshSession_shouldReturnNewRefreshToken() throws Exception {
        UUID sessionId = UUID.randomUUID();

        RefreshTokenRequest request = new RefreshTokenRequest(sessionId, "old-refresh-token-abc");

        Instant newExpiry = Instant.now().plusSeconds(604800);
        RefreshTokenResponse response = new RefreshTokenResponse("new-refresh-token-xyz", newExpiry);

        when(sessionService.refreshSession(eq(sessionId), eq("old-refresh-token-abc"))).thenReturn(response);

        mockMvc.perform(post(BASE_URL + "/{sessionId}/refresh", sessionId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("SUCCESS"))
                .andExpect(jsonPath("$.data.refreshToken").value("new-refresh-token-xyz"))
                .andExpect(jsonPath("$.data.expiresAt").isNotEmpty());

        verify(sessionService).refreshSession(eq(sessionId), eq("old-refresh-token-abc"));
    }

    // ──────────────────────────── Validation tests ────────────────────────────

    @Test
    @DisplayName("POST / - should reject request with null accountId (validation)")
    void createSession_withNullAccountId_shouldReturn400() throws Exception {
        CreateSessionRequest request = new CreateSessionRequest(
                null, null,
                List.of("PASSWORD"), 1,
                "INTERACTIVE", "10.0.0.1", "Mozilla/5.0",
                null, null, null, null);

        mockMvc.perform(post(BASE_URL)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("POST / - should reject request with null ipAddress (validation)")
    void createSession_withNullIpAddress_shouldReturn400() throws Exception {
        CreateSessionRequest request = new CreateSessionRequest(
                UUID.randomUUID(), null,
                List.of("PASSWORD"), 1,
                "INTERACTIVE", null, "Mozilla/5.0",
                null, null, null, null);

        mockMvc.perform(post(BASE_URL)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest());
    }

    // ──────────────────────────── Response envelope ────────────────────────────

    @Test
    @DisplayName("All responses should use ApiResponse envelope with correct content type")
    void responseEnvelope_shouldContainSuccessStatusAndJsonContentType() throws Exception {
        UUID sessionId = UUID.randomUUID();
        UUID accountId = UUID.randomUUID();
        Instant now = Instant.now();

        SessionResponse response = new SessionResponse(
                sessionId, accountId, "INTERACTIVE", "ACTIVE", 1,
                now, now, now.plusSeconds(28800), null, null, null);

        when(sessionService.getSession(eq(sessionId))).thenReturn(response);

        mockMvc.perform(get(BASE_URL + "/{sessionId}", sessionId))
                .andExpect(status().isOk())
                .andExpect(content().contentType(MediaType.APPLICATION_JSON))
                .andExpect(jsonPath("$.status").value("SUCCESS"))
                .andExpect(jsonPath("$.data").isNotEmpty())
                .andExpect(jsonPath("$.error").doesNotExist());
    }
}
