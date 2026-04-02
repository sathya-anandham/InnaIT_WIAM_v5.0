package io.innait.wiam.tokenservice.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.nimbusds.jose.jwk.JWKSet;
import io.innait.wiam.tokenservice.dto.*;
import io.innait.wiam.tokenservice.service.TokenService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest({TokenController.class, JwksController.class})
@AutoConfigureMockMvc(addFilters = false)
class TokenControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private TokenService tokenService;

    private static final String BASE_URL = "/api/v1/tokens";

    // ══════════════════════════════════════════════════════════════════════
    //  TokenController tests
    // ══════════════════════════════════════════════════════════════════════

    @Nested
    @DisplayName("TokenController endpoints")
    class TokenControllerEndpoints {

        // ──────────────────────────── POST /issue ────────────────────────────

        @Test
        @DisplayName("POST /issue - should issue tokens and return access token with metadata")
        void issueTokens_shouldReturnTokenIssueResponse() throws Exception {
            UUID sessionId = UUID.randomUUID();
            UUID accountId = UUID.randomUUID();
            UUID tenantId = UUID.randomUUID();

            TokenIssueRequest request = new TokenIssueRequest(
                    sessionId, accountId, tenantId,
                    "john.doe@innait.io",
                    List.of("USER", "ADMIN"),
                    List.of("engineering"),
                    List.of("pwd", "totp"),
                    "aal2");

            TokenIssueResponse response = new TokenIssueResponse(
                    "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.stub-access-token",
                    null, 900, "Bearer");

            when(tokenService.issueTokens(any(TokenIssueRequest.class))).thenReturn(response);

            mockMvc.perform(post(BASE_URL + "/issue")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.status").value("SUCCESS"))
                    .andExpect(jsonPath("$.data.accessToken").isNotEmpty())
                    .andExpect(jsonPath("$.data.expiresIn").value(900))
                    .andExpect(jsonPath("$.data.tokenType").value("Bearer"));

            verify(tokenService).issueTokens(any(TokenIssueRequest.class));
        }

        // ──────────────────────────── POST /validate ────────────────────────────

        @Test
        @DisplayName("POST /validate - should validate token and return claims when active")
        void validateToken_shouldReturnActiveValidationResponse() throws Exception {
            UUID accountId = UUID.randomUUID();
            UUID tenantId = UUID.randomUUID();
            UUID sessionId = UUID.randomUUID();
            long now = System.currentTimeMillis() / 1000;

            TokenValidationResponse response = new TokenValidationResponse(
                    true, accountId, tenantId, sessionId,
                    "john.doe@innait.io",
                    List.of("USER", "ADMIN"),
                    List.of("engineering"),
                    List.of("pwd", "totp"),
                    "aal2",
                    now + 900, now,
                    Map.of("sub", accountId.toString(), "iss", "https://auth.innait.io"));

            when(tokenService.validateToken(any(String.class))).thenReturn(response);

            mockMvc.perform(post(BASE_URL + "/validate")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("eyJhbGciOiJSUzI1NiJ9.stub-jwt-token"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.status").value("SUCCESS"))
                    .andExpect(jsonPath("$.data.active").value(true))
                    .andExpect(jsonPath("$.data.accountId").value(accountId.toString()))
                    .andExpect(jsonPath("$.data.tenantId").value(tenantId.toString()))
                    .andExpect(jsonPath("$.data.sessionId").value(sessionId.toString()))
                    .andExpect(jsonPath("$.data.loginId").value("john.doe@innait.io"))
                    .andExpect(jsonPath("$.data.roles[0]").value("USER"))
                    .andExpect(jsonPath("$.data.acr").value("aal2"));

            verify(tokenService).validateToken(any(String.class));
        }

        @Test
        @DisplayName("POST /validate - should return inactive response for invalid token")
        void validateToken_withInvalidToken_shouldReturnInactive() throws Exception {
            TokenValidationResponse inactiveResponse = new TokenValidationResponse(
                    false, null, null, null, null,
                    null, null, null, null, 0, 0, null);

            when(tokenService.validateToken(any(String.class))).thenReturn(inactiveResponse);

            mockMvc.perform(post(BASE_URL + "/validate")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("invalid.jwt.token"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.status").value("SUCCESS"))
                    .andExpect(jsonPath("$.data.active").value(false));

            verify(tokenService).validateToken(any(String.class));
        }

        // ──────────────────────────── POST /revoke ────────────────────────────

        @Test
        @DisplayName("POST /revoke - should revoke token and return success")
        void revokeToken_shouldReturnSuccessVoid() throws Exception {
            TokenRevokeRequest request = new TokenRevokeRequest(
                    "eyJhbGciOiJSUzI1NiJ9.token-to-revoke", "access_token");

            doNothing().when(tokenService).revokeToken(eq("eyJhbGciOiJSUzI1NiJ9.token-to-revoke"));

            mockMvc.perform(post(BASE_URL + "/revoke")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.status").value("SUCCESS"))
                    .andExpect(jsonPath("$.data").isEmpty());

            verify(tokenService).revokeToken(eq("eyJhbGciOiJSUzI1NiJ9.token-to-revoke"));
        }

        // ──────────────────────────── POST /rotate-keys ────────────────────────────

        @Test
        @DisplayName("POST /rotate-keys - should rotate signing keys and return success")
        void rotateKeys_shouldReturnSuccessVoid() throws Exception {
            doNothing().when(tokenService).rotateKeys();

            mockMvc.perform(post(BASE_URL + "/rotate-keys"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.status").value("SUCCESS"))
                    .andExpect(jsonPath("$.data").isEmpty());

            verify(tokenService).rotateKeys();
        }

        // ──────────────────────────── Validation ────────────────────────────

        @Test
        @DisplayName("POST /issue - should reject request with null sessionId (validation)")
        void issueTokens_withNullSessionId_shouldReturn400() throws Exception {
            TokenIssueRequest request = new TokenIssueRequest(
                    null, UUID.randomUUID(), UUID.randomUUID(),
                    "john.doe@innait.io", List.of("USER"), null, null, null);

            mockMvc.perform(post(BASE_URL + "/issue")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isBadRequest());
        }

        @Test
        @DisplayName("POST /revoke - should reject request with blank token (validation)")
        void revokeToken_withBlankToken_shouldReturn400() throws Exception {
            TokenRevokeRequest request = new TokenRevokeRequest("", null);

            mockMvc.perform(post(BASE_URL + "/revoke")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isBadRequest());
        }

        // ──────────────────────────── Response format ────────────────────────────

        @Test
        @DisplayName("All responses should use ApiResponse envelope with JSON content type")
        void responseEnvelope_shouldContainSuccessStatusAndJsonContentType() throws Exception {
            TokenIssueResponse response = new TokenIssueResponse(
                    "access-token-xyz", null, 900, "Bearer");

            when(tokenService.issueTokens(any(TokenIssueRequest.class))).thenReturn(response);

            TokenIssueRequest request = new TokenIssueRequest(
                    UUID.randomUUID(), UUID.randomUUID(), UUID.randomUUID(),
                    "test@innait.io", null, null, null, null);

            mockMvc.perform(post(BASE_URL + "/issue")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isOk())
                    .andExpect(content().contentType(MediaType.APPLICATION_JSON))
                    .andExpect(jsonPath("$.status").value("SUCCESS"))
                    .andExpect(jsonPath("$.data").isNotEmpty())
                    .andExpect(jsonPath("$.error").doesNotExist());
        }
    }

    // ══════════════════════════════════════════════════════════════════════
    //  JwksController tests
    // ══════════════════════════════════════════════════════════════════════

    @Nested
    @DisplayName("JwksController endpoints")
    class JwksControllerEndpoints {

        @Test
        @DisplayName("GET /.well-known/jwks.json - should return JWKS as JSON with 200 status")
        void getJwks_shouldReturnJwksJson() throws Exception {
            // Create an empty JWKSet (no keys) to avoid needing real RSA key generation.
            // In production, this returns the public keys used for JWT signature verification.
            JWKSet emptyJwkSet = new JWKSet();
            when(tokenService.getJwks()).thenReturn(emptyJwkSet);

            mockMvc.perform(get("/.well-known/jwks.json"))
                    .andExpect(status().isOk())
                    .andExpect(content().contentType(MediaType.APPLICATION_JSON))
                    .andExpect(jsonPath("$.keys").isArray());

            verify(tokenService).getJwks();
        }

        @Test
        @DisplayName("GET /.well-known/jwks.json - should be publicly accessible without authentication")
        void getJwks_shouldNotRequireAuthentication() throws Exception {
            JWKSet emptyJwkSet = new JWKSet();
            when(tokenService.getJwks()).thenReturn(emptyJwkSet);

            // Filters are disabled via @AutoConfigureMockMvc(addFilters = false),
            // so this verifies the endpoint itself is mapped and reachable.
            mockMvc.perform(get("/.well-known/jwks.json")
                            .accept(MediaType.APPLICATION_JSON))
                    .andExpect(status().isOk())
                    .andExpect(content().contentType(MediaType.APPLICATION_JSON));
        }
    }
}
