package io.innait.wiam.adminconfigservice.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import io.innait.wiam.adminconfigservice.dto.*;
import io.innait.wiam.adminconfigservice.entity.*;
import io.innait.wiam.adminconfigservice.repository.*;
import io.innait.wiam.adminconfigservice.service.ConfigEncryptionService;
import io.innait.wiam.common.context.TenantContext;
import io.innait.wiam.common.kafka.EventPublisher;
import io.innait.wiam.common.security.JwtAuthenticationFilter;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc(addFilters = false)
@ActiveProfiles("test")
class AdminConfigIntegrationTest {

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;
    @Autowired private TenantRepository tenantRepository;
    @Autowired private TenantDomainRepository domainRepository;
    @Autowired private OrgUnitRepository orgUnitRepository;
    @Autowired private FeatureFlagRepository featureFlagRepository;
    @Autowired private ConnectorRepository connectorRepository;
    @Autowired private SystemSettingRepository settingRepository;
    @Autowired private ApplicationRepository applicationRepository;
    @Autowired private ConfigEncryptionService encryptionService;

    @MockBean private JwtAuthenticationFilter jwtAuthenticationFilter;
    @MockBean private EventPublisher eventPublisher;
    @MockBean private StringRedisTemplate redisTemplate;

    @AfterEach
    void tearDown() {
        TenantContext.clear();
        connectorRepository.deleteAll();
        applicationRepository.deleteAll();
        featureFlagRepository.deleteAll();
        orgUnitRepository.deleteAll();
        domainRepository.deleteAll();
        settingRepository.deleteAll();
        tenantRepository.deleteAll();
    }

    // ---- Helpers ----

    private UUID createTestTenant(String code, String name) throws Exception {
        CreateTenantRequest request = new CreateTenantRequest(
                code, name, SubscriptionTier.PREMIUM, "admin@" + code + ".com", "Admin");

        MvcResult result = mockMvc.perform(post("/api/v1/admin/tenants")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andReturn();

        String json = result.getResponse().getContentAsString();
        return UUID.fromString(objectMapper.readTree(json).path("data").path("tenantId").asText());
    }

    // ======================================================================
    //  1. Full tenant lifecycle: create → configure → domains → org hierarchy
    // ======================================================================
    @Nested
    @WithMockUser(roles = "SUPER_ADMIN")
    class FullTenantLifecycle {

        @Test
        void shouldCreateTenantWithFeatureFlags() throws Exception {
            CreateTenantRequest request = new CreateTenantRequest(
                    "acme", "Acme Corporation", SubscriptionTier.ENTERPRISE,
                    "admin@acme.com", "Super Admin");

            mockMvc.perform(post("/api/v1/admin/tenants")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.data.tenantCode").value("acme"))
                    .andExpect(jsonPath("$.data.tenantName").value("Acme Corporation"))
                    .andExpect(jsonPath("$.data.subscriptionTier").value("ENTERPRISE"))
                    .andExpect(jsonPath("$.data.status").value("PENDING_SETUP"));

            // Verify feature flags were initialized (9 default flags)
            List<FeatureFlag> flags = featureFlagRepository.findAll();
            assertThat(flags).hasSize(9);
        }

        @Test
        void shouldRejectDuplicateTenantCode() throws Exception {
            createTestTenant("acme", "Acme Corp");

            mockMvc.perform(post("/api/v1/admin/tenants")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(
                                    new CreateTenantRequest("acme", "Acme 2", null, null, null))))
                    .andExpect(status().is5xxServerError());
        }

        @Test
        void shouldUpdateTenantAndActivate() throws Exception {
            UUID tenantId = createTestTenant("acme", "Acme Corp");

            UpdateTenantRequest update = new UpdateTenantRequest(
                    "Acme Corporation", TenantStatus.ACTIVE, null, null);

            mockMvc.perform(put("/api/v1/admin/tenants/" + tenantId)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(update)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.data.tenantName").value("Acme Corporation"))
                    .andExpect(jsonPath("$.data.status").value("ACTIVE"));
        }

        @Test
        void shouldAddDomainAndVerify() throws Exception {
            UUID tenantId = createTestTenant("acme", "Acme Corp");

            // Add domain
            MvcResult addResult = mockMvc.perform(post("/api/v1/admin/tenants/" + tenantId + "/domains")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(new AddDomainRequest("acme.com"))))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.data.domainName").value("acme.com"))
                    .andExpect(jsonPath("$.data.verificationStatus").value("PENDING"))
                    .andExpect(jsonPath("$.data.verificationToken").isNotEmpty())
                    .andReturn();

            String domainIdStr = objectMapper.readTree(addResult.getResponse().getContentAsString())
                    .path("data").path("domainId").asText();
            UUID domainId = UUID.fromString(domainIdStr);

            // Verify domain (DNS check will fail in test, so status becomes FAILED)
            mockMvc.perform(post("/api/v1/admin/tenants/" + tenantId + "/domains/" + domainId + "/verify"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.data.verificationStatus").value("FAILED"));

            // List domains
            mockMvc.perform(get("/api/v1/admin/tenants/" + tenantId + "/domains"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.data", hasSize(1)));
        }

        @Test
        void shouldBuildOrgUnitHierarchy() throws Exception {
            UUID tenantId = createTestTenant("acme", "Acme Corp");

            // Create root org unit
            MvcResult rootResult = mockMvc.perform(post("/api/v1/admin/tenants/" + tenantId + "/org-units")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(
                                    new CreateOrgUnitRequest("HQ", "Headquarters", null, "Main office"))))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.data.orgCode").value("HQ"))
                    .andReturn();

            UUID rootId = UUID.fromString(objectMapper.readTree(rootResult.getResponse().getContentAsString())
                    .path("data").path("orgUnitId").asText());

            // Create child org unit
            mockMvc.perform(post("/api/v1/admin/tenants/" + tenantId + "/org-units")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(
                                    new CreateOrgUnitRequest("ENG", "Engineering", rootId, "Engineering dept"))))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.data.parentOrgUnitId").value(rootId.toString()));

            // Create another child
            mockMvc.perform(post("/api/v1/admin/tenants/" + tenantId + "/org-units")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(
                                    new CreateOrgUnitRequest("HR", "Human Resources", rootId, null))))
                    .andExpect(status().isOk());

            // List all org units
            mockMvc.perform(get("/api/v1/admin/tenants/" + tenantId + "/org-units"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.data", hasSize(3)));

            // List roots only
            mockMvc.perform(get("/api/v1/admin/tenants/" + tenantId + "/org-units/roots"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.data", hasSize(1)))
                    .andExpect(jsonPath("$.data[0].orgCode").value("HQ"));
        }

        @Test
        void shouldRunFullLifecycleEndToEnd() throws Exception {
            // 1. Create tenant
            UUID tenantId = createTestTenant("fulltest", "Full Test Corp");

            // 2. Update status to ACTIVE
            mockMvc.perform(put("/api/v1/admin/tenants/" + tenantId)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(
                                    new UpdateTenantRequest(null, TenantStatus.ACTIVE, null, null))))
                    .andExpect(status().isOk());

            // 3. Add domain
            mockMvc.perform(post("/api/v1/admin/tenants/" + tenantId + "/domains")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(new AddDomainRequest("fulltest.io"))))
                    .andExpect(status().isOk());

            // 4. Create org hierarchy
            MvcResult rootResult = mockMvc.perform(post("/api/v1/admin/tenants/" + tenantId + "/org-units")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(
                                    new CreateOrgUnitRequest("ROOT", "Root", null, null))))
                    .andExpect(status().isOk())
                    .andReturn();

            UUID rootId = UUID.fromString(objectMapper.readTree(rootResult.getResponse().getContentAsString())
                    .path("data").path("orgUnitId").asText());

            mockMvc.perform(post("/api/v1/admin/tenants/" + tenantId + "/org-units")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(
                                    new CreateOrgUnitRequest("DEPT_A", "Department A", rootId, null))))
                    .andExpect(status().isOk());

            // 5. Verify final state
            mockMvc.perform(get("/api/v1/admin/tenants/" + tenantId))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.data.status").value("ACTIVE"));

            mockMvc.perform(get("/api/v1/admin/tenants/" + tenantId + "/domains"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.data", hasSize(1)));

            mockMvc.perform(get("/api/v1/admin/tenants/" + tenantId + "/org-units"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.data", hasSize(2)));

            // Feature flags should exist
            assertThat(featureFlagRepository.findAll()).hasSizeGreaterThanOrEqualTo(9);
        }
    }

    // ======================================================================
    //  2. Feature flag toggle → cache invalidation
    // ======================================================================
    @Nested
    @WithMockUser(roles = "TENANT_ADMIN")
    class FeatureFlagToggle {

        @Test
        void shouldToggleFlagAndListAll() throws Exception {
            // Seed a tenant and flags
            UUID tenantId = seedTenantWithFlags();
            TenantContext.setTenantId(tenantId);

            // Set flag to true
            mockMvc.perform(put("/api/v1/admin/features/sso_enabled")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(new SetFeatureFlagRequest(true))))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.data.flagKey").value("sso_enabled"))
                    .andExpect(jsonPath("$.data.flagValue").value(true));

            // List all flags
            mockMvc.perform(get("/api/v1/admin/features"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.data.sso_enabled").value(true));
        }

        @Test
        void shouldToggleFlagBackToFalse() throws Exception {
            UUID tenantId = seedTenantWithFlags();
            TenantContext.setTenantId(tenantId);

            // Set to true, then false
            mockMvc.perform(put("/api/v1/admin/features/iga_enabled")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(new SetFeatureFlagRequest(true))))
                    .andExpect(status().isOk());

            mockMvc.perform(put("/api/v1/admin/features/iga_enabled")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(new SetFeatureFlagRequest(false))))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.data.flagValue").value(false));
        }

        private UUID seedTenantWithFlags() {
            UUID tenantId = UUID.randomUUID();
            Tenant tenant = new Tenant(tenantId, "flagtest-" + tenantId.toString().substring(0, 8),
                    "Flag Test", SubscriptionTier.STANDARD);
            tenantRepository.save(tenant);

            TenantContext.setTenantId(tenantId);
            featureFlagRepository.save(new FeatureFlag("sso_enabled", false, "SSO"));
            featureFlagRepository.save(new FeatureFlag("iga_enabled", false, "IGA"));
            TenantContext.clear();

            return tenantId;
        }
    }

    // ======================================================================
    //  3. Connector CRUD + encrypted config + test
    // ======================================================================
    @Nested
    @WithMockUser(roles = "TENANT_ADMIN")
    class ConnectorLifecycle {

        @Test
        void shouldCreateConnectorWithEncryptedConfig() throws Exception {
            UUID tenantId = seedTenant();
            TenantContext.setTenantId(tenantId);

            CreateConnectorRequest request = new CreateConnectorRequest(
                    "LDAP Prod", ConnectorType.LDAP,
                    Map.of("url", "ldap://ldap.acme.com:389",
                            "bindDn", "cn=admin,dc=acme",
                            "bindPassword", "s3cr3t"));

            mockMvc.perform(post("/api/v1/admin/connectors")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.data.connectorName").value("LDAP Prod"))
                    .andExpect(jsonPath("$.data.connectorType").value("LDAP"))
                    .andExpect(jsonPath("$.data.status").value("CONFIGURING"));

            // Verify config is encrypted in DB
            List<Connector> connectors = connectorRepository.findByTenantId(tenantId);
            assertThat(connectors).hasSize(1);
            String encrypted = connectors.get(0).getEncryptedConfig();
            assertThat(encrypted).doesNotContain("s3cr3t");

            // Verify decryption round-trip
            Map<String, Object> decrypted = encryptionService.decrypt(encrypted);
            assertThat(decrypted).containsEntry("bindPassword", "s3cr3t");
        }

        @Test
        void shouldTestConnectorAndReportResult() throws Exception {
            UUID tenantId = seedTenant();
            TenantContext.setTenantId(tenantId);

            // Create a connector with invalid LDAP URL (test will fail)
            CreateConnectorRequest request = new CreateConnectorRequest(
                    "Bad LDAP", ConnectorType.LDAP,
                    Map.of("url", "ldap://nonexistent.invalid:389",
                            "bindDn", "cn=admin", "bindPassword", "pass"));

            MvcResult createResult = mockMvc.perform(post("/api/v1/admin/connectors")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isOk())
                    .andReturn();

            UUID connectorId = UUID.fromString(objectMapper.readTree(
                    createResult.getResponse().getContentAsString())
                    .path("data").path("connectorId").asText());

            // Test connector — should fail since LDAP host doesn't exist
            mockMvc.perform(post("/api/v1/admin/connectors/" + connectorId + "/test"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.data.success").value(false))
                    .andExpect(jsonPath("$.data.message").isNotEmpty());
        }

        private UUID seedTenant() {
            UUID tenantId = UUID.randomUUID();
            Tenant tenant = new Tenant(tenantId, "conntest-" + tenantId.toString().substring(0, 8),
                    "Connector Test", SubscriptionTier.STANDARD);
            tenantRepository.save(tenant);
            return tenantId;
        }
    }

    // ======================================================================
    //  4. System settings hierarchy (tenant > global)
    // ======================================================================
    @Nested
    @WithMockUser(roles = "TENANT_ADMIN")
    class SystemSettingsHierarchy {

        @Test
        void shouldReturnGlobalSettingWhenNoOverride() throws Exception {
            UUID tenantId = seedTenantWithSettings();
            TenantContext.setTenantId(tenantId);

            mockMvc.perform(get("/api/v1/admin/settings/session.idle.timeout.minutes"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.data.settingValue").value("30"))
                    .andExpect(jsonPath("$.data.tenantOverride").value(false));
        }

        @Test
        void shouldCreateTenantOverrideAndReturnIt() throws Exception {
            UUID tenantId = seedTenantWithSettings();
            TenantContext.setTenantId(tenantId);

            // Set tenant override
            mockMvc.perform(put("/api/v1/admin/settings/session.idle.timeout.minutes")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(new SetSettingRequest("15"))))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.data.settingValue").value("15"))
                    .andExpect(jsonPath("$.data.tenantOverride").value(true));

            // Verify the override is returned
            mockMvc.perform(get("/api/v1/admin/settings/session.idle.timeout.minutes"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.data.settingValue").value("15"))
                    .andExpect(jsonPath("$.data.tenantOverride").value(true));
        }

        @Test
        void shouldMergeGlobalAndTenantSettingsInList() throws Exception {
            UUID tenantId = seedTenantWithSettings();
            TenantContext.setTenantId(tenantId);

            // Add tenant override for one setting
            settingRepository.save(new SystemSetting(
                    tenantId, "session.idle.timeout.minutes", "15",
                    SettingValueType.NUMBER, null, false));

            mockMvc.perform(get("/api/v1/admin/settings"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.data", hasSize(2)));
        }

        private UUID seedTenantWithSettings() {
            UUID tenantId = UUID.randomUUID();
            Tenant tenant = new Tenant(tenantId, "settest-" + tenantId.toString().substring(0, 8),
                    "Settings Test", SubscriptionTier.STANDARD);
            tenantRepository.save(tenant);

            // Global settings
            settingRepository.save(new SystemSetting(null, "session.idle.timeout.minutes", "30",
                    SettingValueType.NUMBER, "Session timeout", false));
            settingRepository.save(new SystemSetting(null, "otp.validity.seconds", "300",
                    SettingValueType.NUMBER, "OTP TTL", false));

            return tenantId;
        }
    }

    // ======================================================================
    //  5. Application CRUD
    // ======================================================================
    @Nested
    @WithMockUser(roles = "TENANT_ADMIN")
    class ApplicationCrud {

        @Test
        void shouldCreateAndListApplications() throws Exception {
            UUID tenantId = seedTenant();
            TenantContext.setTenantId(tenantId);

            mockMvc.perform(post("/api/v1/admin/applications")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(
                                    new CreateApplicationRequest("hrms", "HRMS Portal",
                                            AppType.WEB, "https://hrms.acme.com", "HR system"))))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.data.appCode").value("hrms"))
                    .andExpect(jsonPath("$.data.appType").value("WEB"));

            mockMvc.perform(post("/api/v1/admin/applications")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(
                                    new CreateApplicationRequest("crm-api", "CRM API",
                                            AppType.API, "https://api.acme.com/crm", null))))
                    .andExpect(status().isOk());

            mockMvc.perform(get("/api/v1/admin/applications"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.data", hasSize(2)));
        }

        private UUID seedTenant() {
            UUID tenantId = UUID.randomUUID();
            Tenant tenant = new Tenant(tenantId, "apptest-" + tenantId.toString().substring(0, 8),
                    "App Test", SubscriptionTier.STANDARD);
            tenantRepository.save(tenant);
            return tenantId;
        }
    }
}
