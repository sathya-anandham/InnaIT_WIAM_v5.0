package io.innait.wiam.credentialservice.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import io.innait.wiam.credentialservice.dto.BackupCodeGenerateResponse;
import io.innait.wiam.credentialservice.dto.BackupCodeVerifyRequest;
import io.innait.wiam.credentialservice.service.BackupCodeService;
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
import java.util.UUID;

import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(BackupCodeController.class)
@AutoConfigureMockMvc(addFilters = false)
class BackupCodeControllerTest {

    private static final String BASE = "/api/v1/credentials/backup-codes";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private BackupCodeService backupCodeService;

    private final UUID accountId = UUID.randomUUID();

    // ---- Generate ----

    @Nested
    @DisplayName("POST /generate")
    class Generate {

        @Test
        @DisplayName("should generate backup codes and return them in response")
        void generateSuccess() throws Exception {
            List<String> codes = List.of(
                    "AB3CD4EF", "GH5JK6LM", "NP7QR8ST",
                    "UV9WX2YZ", "AB3CD4EG", "GH5JK6LN",
                    "NP7QR8SU", "UV9WX2YA", "BC4DE5FG",
                    "HJ6KL7MN"
            );
            BackupCodeGenerateResponse generateResponse = new BackupCodeGenerateResponse(codes, 10);

            when(backupCodeService.generate(eq(accountId))).thenReturn(generateResponse);

            mockMvc.perform(post(BASE + "/generate")
                            .param("accountId", accountId.toString()))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.status").value("SUCCESS"))
                    .andExpect(jsonPath("$.data.codes").isArray())
                    .andExpect(jsonPath("$.data.codes.length()").value(10))
                    .andExpect(jsonPath("$.data.totalCount").value(10));

            verify(backupCodeService).generate(eq(accountId));
        }
    }

    // ---- Verify ----

    @Nested
    @DisplayName("POST /verify")
    class Verify {

        @Test
        @DisplayName("should return valid=true when backup code is correct")
        void verifyValid() throws Exception {
            when(backupCodeService.verify(eq(accountId), eq("AB3CD4EF")))
                    .thenReturn(true);

            BackupCodeVerifyRequest request = new BackupCodeVerifyRequest(accountId, "AB3CD4EF");

            mockMvc.perform(post(BASE + "/verify")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.status").value("SUCCESS"))
                    .andExpect(jsonPath("$.data.valid").value(true));
        }

        @Test
        @DisplayName("should return valid=false when backup code is incorrect")
        void verifyInvalid() throws Exception {
            when(backupCodeService.verify(eq(accountId), eq("WRONGCODE")))
                    .thenReturn(false);

            BackupCodeVerifyRequest request = new BackupCodeVerifyRequest(accountId, "WRONGCODE");

            mockMvc.perform(post(BASE + "/verify")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.status").value("SUCCESS"))
                    .andExpect(jsonPath("$.data.valid").value(false));
        }
    }

    // ---- Remaining ----

    @Nested
    @DisplayName("GET /remaining")
    class Remaining {

        @Test
        @DisplayName("should return remaining backup code count")
        void remainingCount() throws Exception {
            when(backupCodeService.getRemainingCount(eq(accountId))).thenReturn(7);

            mockMvc.perform(get(BASE + "/remaining")
                            .param("accountId", accountId.toString()))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.status").value("SUCCESS"))
                    .andExpect(jsonPath("$.data.remaining").value(7));

            verify(backupCodeService).getRemainingCount(eq(accountId));
        }
    }
}
