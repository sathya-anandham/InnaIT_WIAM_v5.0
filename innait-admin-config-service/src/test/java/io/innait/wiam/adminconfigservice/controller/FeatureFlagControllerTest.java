package io.innait.wiam.adminconfigservice.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import io.innait.wiam.adminconfigservice.dto.FeatureFlagResponse;
import io.innait.wiam.adminconfigservice.dto.SetFeatureFlagRequest;
import io.innait.wiam.adminconfigservice.service.FeatureFlagService;
import io.innait.wiam.common.context.TenantContext;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.hamcrest.Matchers.*;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(FeatureFlagController.class)
@AutoConfigureMockMvc(addFilters = false)
class FeatureFlagControllerTest {

    private static final String BASE_URL = "/api/v1/admin/features";
    private static final UUID TENANT_ID = UUID.fromString("00000000-0000-0000-0000-000000000001");

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private FeatureFlagService featureFlagService;

    @BeforeEach
    void setUp() {
        TenantContext.setTenantId(TENANT_ID);
    }

    @AfterEach
    void tearDown() {
        TenantContext.clear();
    }

    // ----- get flag -----

    @Test
    void getFlag_shouldReturn200WithBooleanValue() throws Exception {
        when(featureFlagService.getFlag(TENANT_ID, "sso_enabled")).thenReturn(true);

        mockMvc.perform(get(BASE_URL + "/sso_enabled"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("SUCCESS"))
                .andExpect(jsonPath("$.data").value(true));

        verify(featureFlagService).getFlag(TENANT_ID, "sso_enabled");
    }

    @Test
    void getFlag_shouldReturnFalseWhenFlagDisabled() throws Exception {
        when(featureFlagService.getFlag(TENANT_ID, "iga_enabled")).thenReturn(false);

        mockMvc.perform(get(BASE_URL + "/iga_enabled"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("SUCCESS"))
                .andExpect(jsonPath("$.data").value(false));
    }

    // ----- set flag -----

    @Test
    void setFlag_shouldReturn200WithFeatureFlagResponse() throws Exception {
        UUID flagId = UUID.randomUUID();
        FeatureFlagResponse response = new FeatureFlagResponse(
                flagId, TENANT_ID, "sso_enabled", true, "Single sign-on");

        when(featureFlagService.setFlag(eq(TENANT_ID), eq("sso_enabled"), eq(true)))
                .thenReturn(response);

        SetFeatureFlagRequest request = new SetFeatureFlagRequest(true);

        mockMvc.perform(put(BASE_URL + "/sso_enabled")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("SUCCESS"))
                .andExpect(jsonPath("$.data.featureFlagId").value(flagId.toString()))
                .andExpect(jsonPath("$.data.tenantId").value(TENANT_ID.toString()))
                .andExpect(jsonPath("$.data.flagKey").value("sso_enabled"))
                .andExpect(jsonPath("$.data.flagValue").value(true))
                .andExpect(jsonPath("$.data.description").value("Single sign-on"));

        verify(featureFlagService).setFlag(TENANT_ID, "sso_enabled", true);
    }

    // ----- list flags -----

    @Test
    void listFlags_shouldReturn200WithMapOfFlags() throws Exception {
        Map<String, Boolean> flags = new LinkedHashMap<>();
        flags.put("sso_enabled", true);
        flags.put("iga_enabled", false);
        flags.put("passwordless_enabled", true);

        when(featureFlagService.listFlags(TENANT_ID)).thenReturn(flags);

        mockMvc.perform(get(BASE_URL))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("SUCCESS"))
                .andExpect(jsonPath("$.data.sso_enabled").value(true))
                .andExpect(jsonPath("$.data.iga_enabled").value(false))
                .andExpect(jsonPath("$.data.passwordless_enabled").value(true));

        verify(featureFlagService).listFlags(TENANT_ID);
    }

    // ----- list flag details -----

    @Test
    void listFlagDetails_shouldReturn200WithDetailedList() throws Exception {
        UUID id1 = UUID.randomUUID();
        UUID id2 = UUID.randomUUID();

        List<FeatureFlagResponse> details = List.of(
                new FeatureFlagResponse(id1, TENANT_ID, "sso_enabled", true, "SSO feature"),
                new FeatureFlagResponse(id2, TENANT_ID, "iga_enabled", false, "IGA feature")
        );

        when(featureFlagService.listFlagDetails(TENANT_ID)).thenReturn(details);

        mockMvc.perform(get(BASE_URL + "/details"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("SUCCESS"))
                .andExpect(jsonPath("$.data", hasSize(2)))
                .andExpect(jsonPath("$.data[0].flagKey").value("sso_enabled"))
                .andExpect(jsonPath("$.data[0].flagValue").value(true))
                .andExpect(jsonPath("$.data[0].description").value("SSO feature"))
                .andExpect(jsonPath("$.data[1].flagKey").value("iga_enabled"))
                .andExpect(jsonPath("$.data[1].flagValue").value(false));

        verify(featureFlagService).listFlagDetails(TENANT_ID);
    }

    // ----- response format: envelope always contains status + data -----

    @Test
    void responseEnvelope_shouldAlwaysContainStatusAndDataKeys() throws Exception {
        when(featureFlagService.getFlag(TENANT_ID, "any_flag")).thenReturn(false);

        mockMvc.perform(get(BASE_URL + "/any_flag"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").exists())
                .andExpect(jsonPath("$.data").exists())
                .andExpect(jsonPath("$.error").doesNotExist());
    }
}
