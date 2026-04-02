package io.innait.wiam.adminconfigservice.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import io.innait.wiam.adminconfigservice.dto.SetSettingRequest;
import io.innait.wiam.adminconfigservice.dto.SystemSettingResponse;
import io.innait.wiam.adminconfigservice.entity.SettingValueType;
import io.innait.wiam.adminconfigservice.service.SystemSettingsService;
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

import java.util.List;
import java.util.UUID;

import static org.hamcrest.Matchers.*;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(SystemSettingsController.class)
@AutoConfigureMockMvc(addFilters = false)
class SystemSettingsControllerTest {

    private static final String BASE_URL = "/api/v1/admin/settings";
    private static final UUID TENANT_ID = UUID.fromString("00000000-0000-0000-0000-000000000001");

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private SystemSettingsService settingsService;

    @BeforeEach
    void setUp() {
        TenantContext.setTenantId(TENANT_ID);
    }

    @AfterEach
    void tearDown() {
        TenantContext.clear();
    }

    // ----- get setting -----

    @Test
    void getSetting_shouldReturn200WithGlobalSetting() throws Exception {
        UUID settingId = UUID.randomUUID();
        SystemSettingResponse response = new SystemSettingResponse(
                settingId, null, "session.idle.timeout.minutes", "30",
                SettingValueType.NUMBER, "Session idle timeout", false, false);

        when(settingsService.getSettingDetail(TENANT_ID, "session.idle.timeout.minutes"))
                .thenReturn(response);

        mockMvc.perform(get(BASE_URL + "/session.idle.timeout.minutes"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("SUCCESS"))
                .andExpect(jsonPath("$.data.settingKey").value("session.idle.timeout.minutes"))
                .andExpect(jsonPath("$.data.settingValue").value("30"))
                .andExpect(jsonPath("$.data.valueType").value("NUMBER"))
                .andExpect(jsonPath("$.data.tenantOverride").value(false));

        verify(settingsService).getSettingDetail(TENANT_ID, "session.idle.timeout.minutes");
    }

    @Test
    void getSetting_shouldReturnTenantOverrideWhenPresent() throws Exception {
        UUID settingId = UUID.randomUUID();
        SystemSettingResponse response = new SystemSettingResponse(
                settingId, TENANT_ID, "session.idle.timeout.minutes", "15",
                SettingValueType.NUMBER, "Session idle timeout", false, true);

        when(settingsService.getSettingDetail(TENANT_ID, "session.idle.timeout.minutes"))
                .thenReturn(response);

        mockMvc.perform(get(BASE_URL + "/session.idle.timeout.minutes"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.settingValue").value("15"))
                .andExpect(jsonPath("$.data.tenantOverride").value(true));
    }

    // ----- set setting -----

    @Test
    void setSetting_shouldReturn200WithUpdatedSetting() throws Exception {
        UUID settingId = UUID.randomUUID();
        SystemSettingResponse response = new SystemSettingResponse(
                settingId, TENANT_ID, "session.idle.timeout.minutes", "15",
                SettingValueType.NUMBER, null, false, true);

        when(settingsService.setSetting(eq(TENANT_ID), eq("session.idle.timeout.minutes"), eq("15")))
                .thenReturn(response);

        SetSettingRequest request = new SetSettingRequest("15");

        mockMvc.perform(put(BASE_URL + "/session.idle.timeout.minutes")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("SUCCESS"))
                .andExpect(jsonPath("$.data.settingKey").value("session.idle.timeout.minutes"))
                .andExpect(jsonPath("$.data.settingValue").value("15"))
                .andExpect(jsonPath("$.data.tenantOverride").value(true));

        verify(settingsService).setSetting(TENANT_ID, "session.idle.timeout.minutes", "15");
    }

    // ----- list settings -----

    @Test
    void listSettings_shouldReturn200WithMergedSettingsList() throws Exception {
        List<SystemSettingResponse> settings = List.of(
                new SystemSettingResponse(
                        UUID.randomUUID(), null, "session.idle.timeout.minutes", "30",
                        SettingValueType.NUMBER, "Session timeout", false, false),
                new SystemSettingResponse(
                        UUID.randomUUID(), null, "otp.validity.seconds", "300",
                        SettingValueType.NUMBER, "OTP TTL", false, false),
                new SystemSettingResponse(
                        UUID.randomUUID(), TENANT_ID, "max.login.attempts", "5",
                        SettingValueType.NUMBER, "Max login attempts", false, true)
        );

        when(settingsService.listSettings(TENANT_ID)).thenReturn(settings);

        mockMvc.perform(get(BASE_URL))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("SUCCESS"))
                .andExpect(jsonPath("$.data", hasSize(3)))
                .andExpect(jsonPath("$.data[0].settingKey").value("session.idle.timeout.minutes"))
                .andExpect(jsonPath("$.data[2].tenantOverride").value(true));

        verify(settingsService).listSettings(TENANT_ID);
    }

    // ----- response envelope -----

    @Test
    void responseEnvelope_shouldContainStatusAndDataKeys() throws Exception {
        when(settingsService.listSettings(TENANT_ID)).thenReturn(List.of());

        mockMvc.perform(get(BASE_URL))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("SUCCESS"))
                .andExpect(jsonPath("$.data").isArray())
                .andExpect(jsonPath("$.error").doesNotExist());
    }

    // ----- sensitive setting masking -----

    @Test
    void getSetting_shouldReturnMaskedValueForSensitiveSetting() throws Exception {
        UUID settingId = UUID.randomUUID();
        SystemSettingResponse response = new SystemSettingResponse(
                settingId, null, "smtp.password", "***",
                SettingValueType.STRING, "SMTP password", true, false);

        when(settingsService.getSettingDetail(TENANT_ID, "smtp.password"))
                .thenReturn(response);

        mockMvc.perform(get(BASE_URL + "/smtp.password"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.settingValue").value("***"))
                .andExpect(jsonPath("$.data.sensitive").value(true));
    }
}
