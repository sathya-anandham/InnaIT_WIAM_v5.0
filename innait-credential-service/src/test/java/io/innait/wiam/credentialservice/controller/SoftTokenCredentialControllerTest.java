package io.innait.wiam.credentialservice.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import io.innait.wiam.credentialservice.dto.*;
import io.innait.wiam.credentialservice.service.SoftTokenCredentialService;
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

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(SoftTokenCredentialController.class)
@AutoConfigureMockMvc(addFilters = false)
class SoftTokenCredentialControllerTest {

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;
    @MockBean private SoftTokenCredentialService softTokenService;

    private static final UUID ACCOUNT_ID = UUID.randomUUID();
    private static final UUID CREDENTIAL_ID = UUID.randomUUID();

    @Nested
    @DisplayName("POST /provision")
    class Provision {

        @Test
        void shouldProvisionSoftToken() throws Exception {
            // SoftTokenProvisionResponse(UUID credentialId, String deviceId, String activationUrl, String publicKey)
            SoftTokenProvisionResponse response = new SoftTokenProvisionResponse(
                    UUID.randomUUID(), "device-001", "https://innait.io/activate/abc", "public-key-base64");
            when(softTokenService.provision(eq(ACCOUNT_ID), eq("ANDROID"), eq("Pixel 7")))
                    .thenReturn(response);

            mockMvc.perform(post("/api/v1/credentials/softtoken/provision")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(
                                    new SoftTokenProvisionRequest(ACCOUNT_ID, "ANDROID", "Pixel 7"))))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.status").value("SUCCESS"))
                    .andExpect(jsonPath("$.data.deviceId").value("device-001"));
        }
    }

    @Nested
    @DisplayName("POST /activate")
    class Activate {

        @Test
        void shouldActivateSoftToken() throws Exception {
            // SoftTokenActivateRequest(String deviceId, String activationCode, String pushToken)
            // activate(String deviceId, String activationCode, String pushToken)
            when(softTokenService.activate(eq("device-001"), eq("activation-code"), eq("push-token-abc")))
                    .thenReturn(true);

            mockMvc.perform(post("/api/v1/credentials/softtoken/activate")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(
                                    new SoftTokenActivateRequest("device-001", "activation-code", "push-token-abc"))))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.data.activated").value(true));
        }

        @Test
        void shouldReturnFalseForInvalidActivation() throws Exception {
            when(softTokenService.activate(eq("device-001"), eq("wrong-code"), eq("push-token")))
                    .thenReturn(false);

            mockMvc.perform(post("/api/v1/credentials/softtoken/activate")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(
                                    new SoftTokenActivateRequest("device-001", "wrong-code", "push-token"))))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.data.activated").value(false));
        }
    }

    @Nested
    @DisplayName("POST /challenge")
    class Challenge {

        @Test
        void shouldSendPushChallenge() throws Exception {
            // SoftTokenChallengeResponse(String challengeId, String status)
            SoftTokenChallengeResponse response = new SoftTokenChallengeResponse(
                    "challenge-123", "PENDING");
            when(softTokenService.sendPushChallenge(ACCOUNT_ID)).thenReturn(response);

            mockMvc.perform(post("/api/v1/credentials/softtoken/challenge")
                            .param("accountId", ACCOUNT_ID.toString()))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.data.challengeId").value("challenge-123"))
                    .andExpect(jsonPath("$.data.status").value("PENDING"));
        }
    }

    @Nested
    @DisplayName("POST /verify")
    class Verify {

        @Test
        void shouldVerifyPushResponse() throws Exception {
            // SoftTokenVerifyRequest(String challengeId, String signedResponse)
            // verifyPushResponse(String challengeId, String signedResponse)
            when(softTokenService.verifyPushResponse(eq("challenge-123"), eq("signed-response")))
                    .thenReturn(true);

            mockMvc.perform(post("/api/v1/credentials/softtoken/verify")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(
                                    new SoftTokenVerifyRequest("challenge-123", "signed-response"))))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.data.valid").value(true));
        }

        @Test
        void shouldReturnFalseForInvalidSignature() throws Exception {
            when(softTokenService.verifyPushResponse(eq("challenge-123"), eq("invalid-sig")))
                    .thenReturn(false);

            mockMvc.perform(post("/api/v1/credentials/softtoken/verify")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(
                                    new SoftTokenVerifyRequest("challenge-123", "invalid-sig"))))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.data.valid").value(false));
        }
    }

    @Nested
    @DisplayName("DELETE /{credentialId}")
    class Revoke {

        @Test
        void shouldRevokeCredential() throws Exception {
            doNothing().when(softTokenService).revokeCredential(ACCOUNT_ID, CREDENTIAL_ID);

            mockMvc.perform(delete("/api/v1/credentials/softtoken/{credentialId}", CREDENTIAL_ID)
                            .param("accountId", ACCOUNT_ID.toString()))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.status").value("SUCCESS"));

            verify(softTokenService).revokeCredential(ACCOUNT_ID, CREDENTIAL_ID);
        }
    }

    @Nested
    @DisplayName("GET /")
    class ListCredentials {

        @Test
        void shouldListCredentials() throws Exception {
            // SoftTokenCredentialResponse(UUID credentialId, String deviceId, String deviceName,
            //   String devicePlatform, String activationStatus, Instant createdAt, Instant lastUsedAt)
            SoftTokenCredentialResponse cred = new SoftTokenCredentialResponse(
                    CREDENTIAL_ID, "device-001", "Pixel 7", "ANDROID",
                    "ACTIVATED", Instant.now(), Instant.now());
            when(softTokenService.listCredentials(ACCOUNT_ID)).thenReturn(List.of(cred));

            mockMvc.perform(get("/api/v1/credentials/softtoken")
                            .param("accountId", ACCOUNT_ID.toString()))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.data").isArray())
                    .andExpect(jsonPath("$.data[0].deviceName").value("Pixel 7"));
        }
    }
}
