package io.innait.wiam.credentialservice.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import io.innait.wiam.credentialservice.dto.*;
import io.innait.wiam.credentialservice.service.FidoCredentialService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(FidoCredentialController.class)
@AutoConfigureMockMvc(addFilters = false)
class FidoCredentialControllerTest {

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;
    @MockBean private FidoCredentialService fidoService;

    private static final UUID ACCOUNT_ID = UUID.randomUUID();
    private static final UUID CREDENTIAL_ID = UUID.randomUUID();

    @Nested
    @DisplayName("POST /register/begin")
    class RegisterBegin {

        @Test
        void shouldBeginRegistration() throws Exception {
            // FidoRegistrationBeginResponse(UUID txnId, String publicKeyCredentialCreationOptions)
            FidoRegistrationBeginResponse response = new FidoRegistrationBeginResponse(
                    UUID.randomUUID(), "{\"rp\":{\"name\":\"innait\"}}");
            when(fidoService.beginRegistration(eq(ACCOUNT_ID), eq("Test User"))).thenReturn(response);

            mockMvc.perform(post("/api/v1/credentials/fido/register/begin")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(
                                    new FidoRegistrationBeginRequest(ACCOUNT_ID, "Test User"))))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.status").value("SUCCESS"))
                    .andExpect(jsonPath("$.data.txnId").isNotEmpty());
        }
    }

    @Nested
    @DisplayName("POST /register/complete")
    class RegisterComplete {

        @Test
        void shouldCompleteRegistration() throws Exception {
            FidoCredentialResponse response = new FidoCredentialResponse(
                    CREDENTIAL_ID, "cred-id-base64", "Security Key",
                    "ACTIVE", false, false, 0L, Instant.now(), null);
            when(fidoService.completeRegistration(any())).thenReturn(response);

            UUID txnId = UUID.randomUUID();
            FidoRegistrationCompleteRequest request = new FidoRegistrationCompleteRequest(
                    ACCOUNT_ID, txnId, "cred-id-base64", "attestObj64", "clientData64");

            mockMvc.perform(post("/api/v1/credentials/fido/register/complete")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.status").value("SUCCESS"))
                    .andExpect(jsonPath("$.data.credentialId").value(CREDENTIAL_ID.toString()));
        }
    }

    @Nested
    @DisplayName("POST /authenticate/begin")
    class AuthenticateBegin {

        @Test
        void shouldBeginAuthentication() throws Exception {
            // FidoAuthenticationBeginResponse(UUID txnId, String publicKeyCredentialRequestOptions)
            FidoAuthenticationBeginResponse response = new FidoAuthenticationBeginResponse(
                    UUID.randomUUID(), "{\"challenge\":\"abc\"}");
            when(fidoService.beginAuthentication(ACCOUNT_ID)).thenReturn(response);

            mockMvc.perform(post("/api/v1/credentials/fido/authenticate/begin")
                            .param("accountId", ACCOUNT_ID.toString()))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.status").value("SUCCESS"))
                    .andExpect(jsonPath("$.data.txnId").isNotEmpty());
        }
    }

    @Nested
    @DisplayName("POST /authenticate/complete")
    class AuthenticateComplete {

        @Test
        void shouldCompleteAuthentication() throws Exception {
            when(fidoService.completeAuthentication(any())).thenReturn(true);

            UUID txnId = UUID.randomUUID();
            FidoAuthenticationCompleteRequest request = new FidoAuthenticationCompleteRequest(
                    ACCOUNT_ID, txnId, "cred-id", "authData64", "clientData64", "sig64");

            mockMvc.perform(post("/api/v1/credentials/fido/authenticate/complete")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.data.valid").value(true));
        }

        @Test
        void shouldReturnFalseForInvalidAssertion() throws Exception {
            when(fidoService.completeAuthentication(any())).thenReturn(false);

            UUID txnId = UUID.randomUUID();
            FidoAuthenticationCompleteRequest request = new FidoAuthenticationCompleteRequest(
                    ACCOUNT_ID, txnId, "cred-id", "authData64", "clientData64", "sig64");

            mockMvc.perform(post("/api/v1/credentials/fido/authenticate/complete")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.data.valid").value(false));
        }
    }

    @Nested
    @DisplayName("DELETE /{credentialId}")
    class Revoke {

        @Test
        void shouldRevokeCredential() throws Exception {
            doNothing().when(fidoService).revokeCredential(ACCOUNT_ID, CREDENTIAL_ID);

            mockMvc.perform(delete("/api/v1/credentials/fido/{credentialId}", CREDENTIAL_ID)
                            .param("accountId", ACCOUNT_ID.toString()))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.status").value("SUCCESS"));

            verify(fidoService).revokeCredential(ACCOUNT_ID, CREDENTIAL_ID);
        }
    }

    @Nested
    @DisplayName("GET /")
    class ListCredentials {

        @Test
        void shouldListCredentials() throws Exception {
            FidoCredentialResponse cred = new FidoCredentialResponse(
                    CREDENTIAL_ID, "cred-id-base64", "My Key",
                    "ACTIVE", true, false, 5L, Instant.now(), Instant.now());
            when(fidoService.listCredentials(ACCOUNT_ID)).thenReturn(List.of(cred));

            mockMvc.perform(get("/api/v1/credentials/fido")
                            .param("accountId", ACCOUNT_ID.toString()))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.data").isArray())
                    .andExpect(jsonPath("$.data[0].displayName").value("My Key"));
        }
    }
}
