package io.innait.wiam.credentialservice.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import io.innait.wiam.credentialservice.dto.PasswordChangeRequest;
import io.innait.wiam.credentialservice.dto.PasswordEnrollRequest;
import io.innait.wiam.credentialservice.dto.PasswordResetRequest;
import io.innait.wiam.credentialservice.dto.PasswordVerifyRequest;
import io.innait.wiam.credentialservice.service.PasswordCredentialService;
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
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(PasswordCredentialController.class)
@AutoConfigureMockMvc(addFilters = false)
class PasswordCredentialControllerTest {

    private static final String BASE = "/api/v1/credentials/password";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private PasswordCredentialService passwordService;

    private final UUID accountId = UUID.randomUUID();

    // ---- Enroll ----

    @Nested
    @DisplayName("POST /enroll")
    class Enroll {

        @Test
        @DisplayName("should enroll password and return success")
        void enrollSuccess() throws Exception {
            doNothing().when(passwordService)
                    .enrollPassword(any(UUID.class), any(String.class));

            PasswordEnrollRequest request = new PasswordEnrollRequest(accountId, "StrongP@ss1");

            mockMvc.perform(post(BASE + "/enroll")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.status").value("SUCCESS"))
                    .andExpect(jsonPath("$.data").doesNotExist());

            verify(passwordService).enrollPassword(eq(accountId), eq("StrongP@ss1"));
        }

        @Test
        @DisplayName("should reject enroll with missing accountId")
        void enrollMissingAccountId() throws Exception {
            String body = """
                    {"password": "StrongP@ss1"}
                    """;

            mockMvc.perform(post(BASE + "/enroll")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(body))
                    .andExpect(status().isBadRequest());
        }

        @Test
        @DisplayName("should reject enroll with blank password")
        void enrollBlankPassword() throws Exception {
            String body = String.format("""
                    {"accountId": "%s", "password": ""}
                    """, accountId);

            mockMvc.perform(post(BASE + "/enroll")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(body))
                    .andExpect(status().isBadRequest());
        }
    }

    // ---- Verify ----

    @Nested
    @DisplayName("POST /verify")
    class Verify {

        @Test
        @DisplayName("should return valid=true when password matches")
        void verifyValid() throws Exception {
            when(passwordService.verifyPassword(eq(accountId), eq("StrongP@ss1")))
                    .thenReturn(true);

            PasswordVerifyRequest request = new PasswordVerifyRequest(accountId, "StrongP@ss1");

            mockMvc.perform(post(BASE + "/verify")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.status").value("SUCCESS"))
                    .andExpect(jsonPath("$.data.valid").value(true));
        }

        @Test
        @DisplayName("should return valid=false when password does not match")
        void verifyInvalid() throws Exception {
            when(passwordService.verifyPassword(eq(accountId), eq("WrongPassword")))
                    .thenReturn(false);

            PasswordVerifyRequest request = new PasswordVerifyRequest(accountId, "WrongPassword");

            mockMvc.perform(post(BASE + "/verify")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.status").value("SUCCESS"))
                    .andExpect(jsonPath("$.data.valid").value(false));
        }
    }

    // ---- Change ----

    @Nested
    @DisplayName("POST /change")
    class Change {

        @Test
        @DisplayName("should change password and return success")
        void changeSuccess() throws Exception {
            doNothing().when(passwordService)
                    .changePassword(any(UUID.class), any(String.class), any(String.class));

            PasswordChangeRequest request =
                    new PasswordChangeRequest(accountId, "OldP@ss123", "NewP@ss456");

            mockMvc.perform(post(BASE + "/change")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.status").value("SUCCESS"))
                    .andExpect(jsonPath("$.data").doesNotExist());

            verify(passwordService).changePassword(eq(accountId), eq("OldP@ss123"), eq("NewP@ss456"));
        }
    }

    // ---- Reset ----

    @Nested
    @DisplayName("POST /reset")
    class Reset {

        @Test
        @DisplayName("should reset password and return success")
        void resetSuccess() throws Exception {
            UUID adminId = UUID.randomUUID();
            doNothing().when(passwordService)
                    .resetPassword(any(UUID.class), any(String.class), any(UUID.class));

            PasswordResetRequest request =
                    new PasswordResetRequest(accountId, "TempP@ss789", adminId);

            mockMvc.perform(post(BASE + "/reset")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.status").value("SUCCESS"))
                    .andExpect(jsonPath("$.data").doesNotExist());

            verify(passwordService).resetPassword(eq(accountId), eq("TempP@ss789"), eq(adminId));
        }
    }

    // ---- Response envelope ----

    @Test
    @DisplayName("should wrap response in ApiResponse envelope with status field")
    void responseEnvelope() throws Exception {
        when(passwordService.verifyPassword(any(UUID.class), any(String.class)))
                .thenReturn(true);

        PasswordVerifyRequest request = new PasswordVerifyRequest(accountId, "AnyP@ss1");

        mockMvc.perform(post(BASE + "/verify")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").exists())
                .andExpect(jsonPath("$.status").value("SUCCESS"))
                .andExpect(jsonPath("$.data").exists())
                .andExpect(jsonPath("$.error").doesNotExist());
    }
}
