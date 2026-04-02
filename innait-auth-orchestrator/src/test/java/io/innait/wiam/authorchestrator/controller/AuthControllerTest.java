package io.innait.wiam.authorchestrator.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import io.innait.wiam.authorchestrator.dto.*;
import io.innait.wiam.authorchestrator.service.AuthOrchestrationService;
import org.junit.jupiter.api.DisplayName;
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

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(AuthController.class)
@AutoConfigureMockMvc(addFilters = false)
class AuthControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private AuthOrchestrationService authService;

    private static final String BASE_URL = "/api/v1/auth";

    // ──────────────────────────── POST /login/initiate ────────────────────────────

    @Test
    @DisplayName("POST /login/initiate - should initiate auth and return txnId with primary methods")
    void initiate_shouldReturnAuthInitiateResponse() throws Exception {
        UUID txnId = UUID.randomUUID();
        AuthInitiateRequest request = new AuthInitiateRequest(
                "john.doe@innait.io", "WEB", "10.0.0.1", "Mozilla/5.0");

        AuthInitiateResponse response = new AuthInitiateResponse(
                txnId, "PRIMARY_CHALLENGE", List.of("PASSWORD", "FIDO"));

        when(authService.initiateAuth(any(AuthInitiateRequest.class))).thenReturn(response);

        mockMvc.perform(post(BASE_URL + "/login/initiate")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("SUCCESS"))
                .andExpect(jsonPath("$.data.txnId").value(txnId.toString()))
                .andExpect(jsonPath("$.data.state").value("PRIMARY_CHALLENGE"))
                .andExpect(jsonPath("$.data.primaryMethods[0]").value("PASSWORD"))
                .andExpect(jsonPath("$.data.primaryMethods[1]").value("FIDO"));

        verify(authService).initiateAuth(any(AuthInitiateRequest.class));
    }

    // ──────────────────────────── POST /login/primary ────────────────────────────

    @Test
    @DisplayName("POST /login/primary - should submit primary factor and return result")
    void submitPrimary_shouldReturnPrimaryFactorResponse() throws Exception {
        UUID txnId = UUID.randomUUID();
        FactorSubmitRequest request = new FactorSubmitRequest(
                txnId, "PASSWORD", Map.of("password", "s3cur3Pa$$"));

        PrimaryFactorResponse response = new PrimaryFactorResponse(
                txnId, "MFA_CHALLENGE", true,
                List.of("TOTP", "FIDO"), null);

        when(authService.submitPrimaryFactor(any(FactorSubmitRequest.class))).thenReturn(response);

        mockMvc.perform(post(BASE_URL + "/login/primary")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("SUCCESS"))
                .andExpect(jsonPath("$.data.txnId").value(txnId.toString()))
                .andExpect(jsonPath("$.data.state").value("MFA_CHALLENGE"))
                .andExpect(jsonPath("$.data.mfaRequired").value(true))
                .andExpect(jsonPath("$.data.mfaMethods[0]").value("TOTP"));

        verify(authService).submitPrimaryFactor(any(FactorSubmitRequest.class));
    }

    // ──────────────────────────── POST /login/mfa ────────────────────────────

    @Test
    @DisplayName("POST /login/mfa - should submit MFA factor and return completed state with tokens")
    void submitMfa_shouldReturnMfaFactorResponse() throws Exception {
        UUID txnId = UUID.randomUUID();
        FactorSubmitRequest request = new FactorSubmitRequest(
                txnId, "TOTP", Map.of("code", "123456"));

        TokenSet tokens = new TokenSet("access-token-xyz", "refresh-token-xyz", 3600);
        MfaFactorResponse response = new MfaFactorResponse(txnId, "COMPLETED", tokens);

        when(authService.submitMfaFactor(any(FactorSubmitRequest.class))).thenReturn(response);

        mockMvc.perform(post(BASE_URL + "/login/mfa")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("SUCCESS"))
                .andExpect(jsonPath("$.data.txnId").value(txnId.toString()))
                .andExpect(jsonPath("$.data.state").value("COMPLETED"))
                .andExpect(jsonPath("$.data.tokens.accessToken").value("access-token-xyz"))
                .andExpect(jsonPath("$.data.tokens.refreshToken").value("refresh-token-xyz"))
                .andExpect(jsonPath("$.data.tokens.expiresIn").value(3600));

        verify(authService).submitMfaFactor(any(FactorSubmitRequest.class));
    }

    // ──────────────────────────── GET /login/{txnId}/status ────────────────────────────

    @Test
    @DisplayName("GET /login/{txnId}/status - should return current auth transaction status")
    void getStatus_shouldReturnAuthStatusResponse() throws Exception {
        UUID txnId = UUID.randomUUID();
        Instant startedAt = Instant.parse("2026-04-01T10:00:00Z");
        Instant expiresAt = Instant.parse("2026-04-01T10:05:00Z");

        AuthStatusResponse response = new AuthStatusResponse(
                txnId, "PRIMARY_CHALLENGE", startedAt, expiresAt, null);

        when(authService.getAuthStatus(eq(txnId))).thenReturn(response);

        mockMvc.perform(get(BASE_URL + "/login/{txnId}/status", txnId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("SUCCESS"))
                .andExpect(jsonPath("$.data.txnId").value(txnId.toString()))
                .andExpect(jsonPath("$.data.state").value("PRIMARY_CHALLENGE"))
                .andExpect(jsonPath("$.data.startedAt").isNotEmpty())
                .andExpect(jsonPath("$.data.expiresAt").isNotEmpty())
                .andExpect(jsonPath("$.data.completedAt").isEmpty());

        verify(authService).getAuthStatus(eq(txnId));
    }

    // ──────────────────────────── POST /login/{txnId}/abort ────────────────────────────

    @Test
    @DisplayName("POST /login/{txnId}/abort - should abort auth and return terminal status")
    void abort_shouldReturnAbortedStatus() throws Exception {
        UUID txnId = UUID.randomUUID();
        Instant now = Instant.now();

        AuthStatusResponse response = new AuthStatusResponse(
                txnId, "ABORTED", now.minusSeconds(60), now.plusSeconds(240), now);

        when(authService.abortAuth(eq(txnId))).thenReturn(response);

        mockMvc.perform(post(BASE_URL + "/login/{txnId}/abort", txnId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("SUCCESS"))
                .andExpect(jsonPath("$.data.txnId").value(txnId.toString()))
                .andExpect(jsonPath("$.data.state").value("ABORTED"))
                .andExpect(jsonPath("$.data.completedAt").isNotEmpty());

        verify(authService).abortAuth(eq(txnId));
    }

    // ──────────────────────────── POST /step-up/initiate ────────────────────────────

    @Test
    @DisplayName("POST /step-up/initiate - should initiate step-up authentication")
    void initiateStepUp_shouldReturnAuthInitiateResponse() throws Exception {
        UUID sessionId = UUID.randomUUID();
        UUID txnId = UUID.randomUUID();

        StepUpInitiateRequest request = new StepUpInitiateRequest(sessionId, "aal2");

        AuthInitiateResponse response = new AuthInitiateResponse(
                txnId, "PRIMARY_CHALLENGE", List.of("PASSWORD", "FIDO"));

        when(authService.initiateStepUp(any(StepUpInitiateRequest.class))).thenReturn(response);

        mockMvc.perform(post(BASE_URL + "/step-up/initiate")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("SUCCESS"))
                .andExpect(jsonPath("$.data.txnId").value(txnId.toString()))
                .andExpect(jsonPath("$.data.state").value("PRIMARY_CHALLENGE"))
                .andExpect(jsonPath("$.data.primaryMethods").isArray());

        verify(authService).initiateStepUp(any(StepUpInitiateRequest.class));
    }

    // ──────────────────────────── Validation: missing loginId ────────────────────────────

    @Test
    @DisplayName("POST /login/initiate - should reject request with blank loginId (validation)")
    void initiate_withBlankLoginId_shouldReturn400() throws Exception {
        AuthInitiateRequest request = new AuthInitiateRequest(
                "", "WEB", "10.0.0.1", "Mozilla/5.0");

        mockMvc.perform(post(BASE_URL + "/login/initiate")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("POST /login/primary - should reject request with null txnId (validation)")
    void submitPrimary_withNullTxnId_shouldReturn400() throws Exception {
        FactorSubmitRequest request = new FactorSubmitRequest(
                null, "PASSWORD", Map.of("password", "secret"));

        mockMvc.perform(post(BASE_URL + "/login/primary")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("POST /login/primary - should reject request with blank factorType (validation)")
    void submitPrimary_withBlankFactorType_shouldReturn400() throws Exception {
        FactorSubmitRequest request = new FactorSubmitRequest(
                UUID.randomUUID(), "", Map.of("password", "secret"));

        mockMvc.perform(post(BASE_URL + "/login/primary")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest());
    }

    // ──────────────────────────── Response envelope structure ────────────────────────────

    @Test
    @DisplayName("All successful responses should follow ApiResponse envelope with SUCCESS status")
    void responseEnvelope_shouldContainSuccessStatusAndDataField() throws Exception {
        UUID txnId = UUID.randomUUID();
        AuthInitiateRequest request = new AuthInitiateRequest(
                "test@innait.io", "WEB", null, null);

        AuthInitiateResponse response = new AuthInitiateResponse(
                txnId, "PRIMARY_CHALLENGE", List.of("PASSWORD"));

        when(authService.initiateAuth(any(AuthInitiateRequest.class))).thenReturn(response);

        mockMvc.perform(post(BASE_URL + "/login/initiate")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(content().contentType(MediaType.APPLICATION_JSON))
                .andExpect(jsonPath("$.status").value("SUCCESS"))
                .andExpect(jsonPath("$.data").isNotEmpty())
                .andExpect(jsonPath("$.error").doesNotExist());
    }
}
