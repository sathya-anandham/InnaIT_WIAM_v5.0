package io.innait.wiam.credentialservice.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import io.innait.wiam.credentialservice.dto.TotpEnrollmentResponse;
import io.innait.wiam.credentialservice.dto.TotpVerifyRequest;
import io.innait.wiam.credentialservice.service.TotpCredentialService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(TotpCredentialController.class)
@AutoConfigureMockMvc(addFilters = false)
class TotpCredentialControllerTest {

    private static final String BASE = "/api/v1/credentials/totp";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private TotpCredentialService totpService;

    private final UUID accountId = UUID.randomUUID();

    // ---- Enroll ----

    @Nested
    @DisplayName("POST /enroll")
    class Enroll {

        @Test
        @DisplayName("should begin enrollment and return TOTP enrollment response")
        void enrollSuccess() throws Exception {
            UUID credentialId = UUID.randomUUID();
            TotpEnrollmentResponse enrollmentResponse = new TotpEnrollmentResponse(
                    credentialId,
                    "otpauth://totp/InnaIT%20WIAM:" + accountId + "?secret=JBSWY3DPEHPK3PXP&issuer=InnaIT%20WIAM&algorithm=SHA1&digits=6&period=30",
                    "JBSWY3DPEHPK3PXP"
            );

            when(totpService.beginEnrollment(eq(accountId))).thenReturn(enrollmentResponse);

            mockMvc.perform(post(BASE + "/enroll")
                            .param("accountId", accountId.toString()))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.status").value("SUCCESS"))
                    .andExpect(jsonPath("$.data.credentialId").value(credentialId.toString()))
                    .andExpect(jsonPath("$.data.secretUri").isNotEmpty())
                    .andExpect(jsonPath("$.data.manualEntryKey").value("JBSWY3DPEHPK3PXP"));

            verify(totpService).beginEnrollment(eq(accountId));
        }
    }

    // ---- Confirm ----

    @Nested
    @DisplayName("POST /confirm")
    class Confirm {

        @Test
        @DisplayName("should confirm enrollment and return confirmed=true")
        void confirmSuccess() throws Exception {
            when(totpService.confirmEnrollment(eq(accountId), eq("123456")))
                    .thenReturn(true);

            TotpVerifyRequest request = new TotpVerifyRequest(accountId, "123456");

            mockMvc.perform(post(BASE + "/confirm")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.status").value("SUCCESS"))
                    .andExpect(jsonPath("$.data.confirmed").value(true));
        }
    }

    // ---- Verify ----

    @Nested
    @DisplayName("POST /verify")
    class Verify {

        @Test
        @DisplayName("should return valid=true when TOTP code is correct")
        void verifyValid() throws Exception {
            when(totpService.verifyTotp(eq(accountId), eq("654321")))
                    .thenReturn(true);

            TotpVerifyRequest request = new TotpVerifyRequest(accountId, "654321");

            mockMvc.perform(post(BASE + "/verify")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.status").value("SUCCESS"))
                    .andExpect(jsonPath("$.data.valid").value(true));
        }

        @Test
        @DisplayName("should return valid=false when TOTP code is incorrect")
        void verifyInvalid() throws Exception {
            when(totpService.verifyTotp(eq(accountId), eq("000000")))
                    .thenReturn(false);

            TotpVerifyRequest request = new TotpVerifyRequest(accountId, "000000");

            mockMvc.perform(post(BASE + "/verify")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.status").value("SUCCESS"))
                    .andExpect(jsonPath("$.data.valid").value(false));
        }
    }

    // ---- Revoke ----

    @Nested
    @DisplayName("DELETE /{credentialId}")
    class Revoke {

        @Test
        @DisplayName("should revoke TOTP credential and return success")
        void revokeSuccess() throws Exception {
            UUID credentialId = UUID.randomUUID();
            doNothing().when(totpService).revokeTotp(any(UUID.class), any(UUID.class));

            mockMvc.perform(delete(BASE + "/" + credentialId)
                            .param("accountId", accountId.toString()))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.status").value("SUCCESS"))
                    .andExpect(jsonPath("$.data").doesNotExist());

            verify(totpService).revokeTotp(eq(accountId), eq(credentialId));
        }
    }
}
