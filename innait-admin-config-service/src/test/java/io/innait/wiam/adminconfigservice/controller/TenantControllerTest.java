package io.innait.wiam.adminconfigservice.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import io.innait.wiam.adminconfigservice.dto.CreateTenantRequest;
import io.innait.wiam.adminconfigservice.dto.TenantResponse;
import io.innait.wiam.adminconfigservice.dto.UpdateTenantRequest;
import io.innait.wiam.adminconfigservice.entity.SubscriptionTier;
import io.innait.wiam.adminconfigservice.entity.TenantStatus;
import io.innait.wiam.adminconfigservice.service.TenantService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import static org.hamcrest.Matchers.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(TenantController.class)
@AutoConfigureMockMvc(addFilters = false)
class TenantControllerTest {

    private static final String BASE_URL = "/api/v1/admin/tenants";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private TenantService tenantService;

    // ----- helpers -----

    private TenantResponse sampleTenantResponse(UUID tenantId) {
        return new TenantResponse(
                tenantId,
                "acme",
                "Acme Corporation",
                TenantStatus.PENDING_SETUP,
                SubscriptionTier.PREMIUM,
                null,
                Instant.parse("2026-01-01T00:00:00Z"),
                Instant.parse("2026-01-01T00:00:00Z")
        );
    }

    // ----- create tenant -----

    @Test
    void createTenant_shouldReturn200WithApiResponseEnvelope() throws Exception {
        UUID tenantId = UUID.randomUUID();
        TenantResponse response = sampleTenantResponse(tenantId);

        when(tenantService.createTenant(any(CreateTenantRequest.class))).thenReturn(response);

        CreateTenantRequest request = new CreateTenantRequest(
                "acme", "Acme Corporation", SubscriptionTier.PREMIUM,
                "admin@acme.com", "Admin User");

        mockMvc.perform(post(BASE_URL)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("SUCCESS"))
                .andExpect(jsonPath("$.data.tenantId").value(tenantId.toString()))
                .andExpect(jsonPath("$.data.tenantCode").value("acme"))
                .andExpect(jsonPath("$.data.tenantName").value("Acme Corporation"))
                .andExpect(jsonPath("$.data.subscriptionTier").value("PREMIUM"))
                .andExpect(jsonPath("$.data.status").value("PENDING_SETUP"));

        verify(tenantService).createTenant(any(CreateTenantRequest.class));
    }

    // ----- update tenant -----

    @Test
    void updateTenant_shouldReturn200WithUpdatedTenant() throws Exception {
        UUID tenantId = UUID.randomUUID();
        TenantResponse response = new TenantResponse(
                tenantId, "acme", "Acme Updated", TenantStatus.ACTIVE,
                SubscriptionTier.ENTERPRISE, null,
                Instant.parse("2026-01-01T00:00:00Z"),
                Instant.parse("2026-02-01T00:00:00Z"));

        when(tenantService.updateTenant(eq(tenantId), any(UpdateTenantRequest.class))).thenReturn(response);

        UpdateTenantRequest request = new UpdateTenantRequest(
                "Acme Updated", TenantStatus.ACTIVE, SubscriptionTier.ENTERPRISE, null);

        mockMvc.perform(put(BASE_URL + "/" + tenantId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("SUCCESS"))
                .andExpect(jsonPath("$.data.tenantName").value("Acme Updated"))
                .andExpect(jsonPath("$.data.status").value("ACTIVE"))
                .andExpect(jsonPath("$.data.subscriptionTier").value("ENTERPRISE"));

        verify(tenantService).updateTenant(eq(tenantId), any(UpdateTenantRequest.class));
    }

    // ----- get tenant -----

    @Test
    void getTenant_shouldReturn200WithTenantData() throws Exception {
        UUID tenantId = UUID.randomUUID();
        TenantResponse response = sampleTenantResponse(tenantId);

        when(tenantService.getTenant(tenantId)).thenReturn(response);

        mockMvc.perform(get(BASE_URL + "/" + tenantId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("SUCCESS"))
                .andExpect(jsonPath("$.data.tenantId").value(tenantId.toString()))
                .andExpect(jsonPath("$.data.tenantCode").value("acme"));

        verify(tenantService).getTenant(tenantId);
    }

    // ----- list tenants -----

    @Test
    void listTenants_shouldReturn200WithPagedResults() throws Exception {
        UUID id1 = UUID.randomUUID();
        UUID id2 = UUID.randomUUID();
        List<TenantResponse> tenants = List.of(
                sampleTenantResponse(id1),
                new TenantResponse(id2, "beta", "Beta Corp", TenantStatus.ACTIVE,
                        SubscriptionTier.STANDARD, null,
                        Instant.parse("2026-01-01T00:00:00Z"),
                        Instant.parse("2026-01-01T00:00:00Z"))
        );
        Page<TenantResponse> page = new PageImpl<>(tenants, PageRequest.of(0, 20), 2);

        when(tenantService.listTenants(any(Pageable.class))).thenReturn(page);

        mockMvc.perform(get(BASE_URL)
                        .param("page", "0")
                        .param("size", "20"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("SUCCESS"))
                .andExpect(jsonPath("$.data.content", hasSize(2)))
                .andExpect(jsonPath("$.data.content[0].tenantCode").value("acme"))
                .andExpect(jsonPath("$.data.content[1].tenantCode").value("beta"))
                .andExpect(jsonPath("$.data.totalElements").value(2));

        verify(tenantService).listTenants(any(Pageable.class));
    }

    // ----- validation: blank tenantCode -----

    @Test
    void createTenant_shouldReject400WhenTenantCodeIsBlank() throws Exception {
        CreateTenantRequest request = new CreateTenantRequest(
                "", "Acme Corporation", SubscriptionTier.PREMIUM,
                "admin@acme.com", "Admin");

        mockMvc.perform(post(BASE_URL)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest());
    }

    // ----- validation: blank tenantName -----

    @Test
    void createTenant_shouldReject400WhenTenantNameIsBlank() throws Exception {
        CreateTenantRequest request = new CreateTenantRequest(
                "acme", "", SubscriptionTier.PREMIUM,
                "admin@acme.com", "Admin");

        mockMvc.perform(post(BASE_URL)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest());
    }

    // ----- validation: tenantCode exceeds max size -----

    @Test
    void createTenant_shouldReject400WhenTenantCodeExceedsMaxSize() throws Exception {
        String longCode = "a".repeat(51); // max is 50
        CreateTenantRequest request = new CreateTenantRequest(
                longCode, "Acme Corporation", SubscriptionTier.PREMIUM,
                "admin@acme.com", "Admin");

        mockMvc.perform(post(BASE_URL)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest());
    }
}
