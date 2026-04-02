package io.innait.wiam.policyservice.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import io.innait.wiam.policyservice.dto.*;
import io.innait.wiam.policyservice.service.PolicyAdminService;
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

import static org.hamcrest.Matchers.hasSize;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(PolicyAdminController.class)
@AutoConfigureMockMvc(addFilters = false)
class PolicyAdminControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private PolicyAdminService adminService;

    private static final String BASE_PATH = "/api/v1/policies";

    // ---- Password Policies ----

    @Nested
    @DisplayName("Password Policy CRUD")
    class PasswordPolicyCrud {

        @Test
        @DisplayName("POST /password - should create a password policy")
        void shouldCreatePasswordPolicy() throws Exception {
            PasswordPolicyCreateRequest request = new PasswordPolicyCreateRequest(
                    "Strong Password Policy", 12, 128,
                    true, true, true, true,
                    3, 5, 90, 1, 5, 30, false);

            UUID policyId = UUID.randomUUID();
            PasswordPolicyResponse response = new PasswordPolicyResponse(
                    policyId, "Strong Password Policy",
                    12, 128, true, true, true, true,
                    3, 5, 90, 1, 5, 30, false, "ACTIVE");

            when(adminService.createPasswordPolicy(any(PasswordPolicyCreateRequest.class)))
                    .thenReturn(response);

            mockMvc.perform(post(BASE_PATH + "/password")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.status").value("SUCCESS"))
                    .andExpect(jsonPath("$.data.passwordPolicyId").value(policyId.toString()))
                    .andExpect(jsonPath("$.data.policyName").value("Strong Password Policy"))
                    .andExpect(jsonPath("$.data.minLength").value(12))
                    .andExpect(jsonPath("$.data.status").value("ACTIVE"));

            verify(adminService).createPasswordPolicy(any(PasswordPolicyCreateRequest.class));
        }

        @Test
        @DisplayName("GET /password/{policyId} - should get a password policy by ID")
        void shouldGetPasswordPolicyById() throws Exception {
            UUID policyId = UUID.randomUUID();
            PasswordPolicyResponse response = new PasswordPolicyResponse(
                    policyId, "Fetched Policy",
                    8, 64, true, true, false, false,
                    2, 3, 60, 0, 3, 15, true, "ACTIVE");

            when(adminService.getPasswordPolicy(policyId)).thenReturn(response);

            mockMvc.perform(get(BASE_PATH + "/password/{policyId}", policyId))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.status").value("SUCCESS"))
                    .andExpect(jsonPath("$.data.passwordPolicyId").value(policyId.toString()))
                    .andExpect(jsonPath("$.data.policyName").value("Fetched Policy"));

            verify(adminService).getPasswordPolicy(policyId);
        }

        @Test
        @DisplayName("GET /password - should list all password policies")
        void shouldListPasswordPolicies() throws Exception {
            PasswordPolicyResponse p1 = new PasswordPolicyResponse(
                    UUID.randomUUID(), "Policy A",
                    8, 64, true, true, true, true,
                    3, 5, 90, 1, 5, 30, true, "ACTIVE");
            PasswordPolicyResponse p2 = new PasswordPolicyResponse(
                    UUID.randomUUID(), "Policy B",
                    10, 128, false, true, true, false,
                    2, 3, 60, 0, 3, 15, false, "ACTIVE");

            when(adminService.listPasswordPolicies()).thenReturn(List.of(p1, p2));

            mockMvc.perform(get(BASE_PATH + "/password"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.status").value("SUCCESS"))
                    .andExpect(jsonPath("$.data", hasSize(2)))
                    .andExpect(jsonPath("$.data[0].policyName").value("Policy A"))
                    .andExpect(jsonPath("$.data[1].policyName").value("Policy B"));

            verify(adminService).listPasswordPolicies();
        }

        @Test
        @DisplayName("PUT /password/{policyId} - should update a password policy")
        void shouldUpdatePasswordPolicy() throws Exception {
            UUID policyId = UUID.randomUUID();
            PasswordPolicyCreateRequest request = new PasswordPolicyCreateRequest(
                    "Updated Policy", 14, 256,
                    true, true, true, true,
                    2, 10, 120, 2, 10, 60, false);

            PasswordPolicyResponse response = new PasswordPolicyResponse(
                    policyId, "Updated Policy",
                    14, 256, true, true, true, true,
                    2, 10, 120, 2, 10, 60, false, "ACTIVE");

            when(adminService.updatePasswordPolicy(eq(policyId), any(PasswordPolicyCreateRequest.class)))
                    .thenReturn(response);

            mockMvc.perform(put(BASE_PATH + "/password/{policyId}", policyId)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.status").value("SUCCESS"))
                    .andExpect(jsonPath("$.data.policyName").value("Updated Policy"))
                    .andExpect(jsonPath("$.data.minLength").value(14));

            verify(adminService).updatePasswordPolicy(eq(policyId), any(PasswordPolicyCreateRequest.class));
        }

        @Test
        @DisplayName("DELETE /password/{policyId} - should delete a password policy")
        void shouldDeletePasswordPolicy() throws Exception {
            UUID policyId = UUID.randomUUID();
            doNothing().when(adminService).deletePasswordPolicy(policyId);

            mockMvc.perform(delete(BASE_PATH + "/password/{policyId}", policyId))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.status").value("SUCCESS"));

            verify(adminService).deletePasswordPolicy(policyId);
        }
    }

    // ---- MFA Policies ----

    @Nested
    @DisplayName("MFA Policy CRUD")
    class MfaPolicyCrud {

        @Test
        @DisplayName("POST /mfa - should create an MFA policy")
        void shouldCreateMfaPolicy() throws Exception {
            MfaPolicyCreateRequest request = new MfaPolicyCreateRequest(
                    "Strict MFA Policy", "REQUIRED",
                    List.of("TOTP", "FIDO2"), 30, 7, false);

            UUID policyId = UUID.randomUUID();
            MfaPolicyResponse response = new MfaPolicyResponse(
                    policyId, "Strict MFA Policy", "REQUIRED",
                    List.of("TOTP", "FIDO2"), 30, 7, false, "ACTIVE");

            when(adminService.createMfaPolicy(any(MfaPolicyCreateRequest.class)))
                    .thenReturn(response);

            mockMvc.perform(post(BASE_PATH + "/mfa")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.status").value("SUCCESS"))
                    .andExpect(jsonPath("$.data.mfaPolicyId").value(policyId.toString()))
                    .andExpect(jsonPath("$.data.policyName").value("Strict MFA Policy"))
                    .andExpect(jsonPath("$.data.enforcementMode").value("REQUIRED"))
                    .andExpect(jsonPath("$.data.allowedMethods", hasSize(2)));

            verify(adminService).createMfaPolicy(any(MfaPolicyCreateRequest.class));
        }

        @Test
        @DisplayName("GET /mfa/{policyId} - should get an MFA policy by ID")
        void shouldGetMfaPolicyById() throws Exception {
            UUID policyId = UUID.randomUUID();
            MfaPolicyResponse response = new MfaPolicyResponse(
                    policyId, "Default MFA", "OPTIONAL",
                    List.of("TOTP"), 14, 3, true, "ACTIVE");

            when(adminService.getMfaPolicy(policyId)).thenReturn(response);

            mockMvc.perform(get(BASE_PATH + "/mfa/{policyId}", policyId))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.status").value("SUCCESS"))
                    .andExpect(jsonPath("$.data.mfaPolicyId").value(policyId.toString()))
                    .andExpect(jsonPath("$.data.policyName").value("Default MFA"));

            verify(adminService).getMfaPolicy(policyId);
        }

        @Test
        @DisplayName("GET /mfa - should list all MFA policies")
        void shouldListMfaPolicies() throws Exception {
            MfaPolicyResponse m1 = new MfaPolicyResponse(
                    UUID.randomUUID(), "MFA A", "REQUIRED",
                    List.of("TOTP"), 30, 7, true, "ACTIVE");
            MfaPolicyResponse m2 = new MfaPolicyResponse(
                    UUID.randomUUID(), "MFA B", "OPTIONAL",
                    List.of("FIDO2", "SMS"), 14, 0, false, "ACTIVE");

            when(adminService.listMfaPolicies()).thenReturn(List.of(m1, m2));

            mockMvc.perform(get(BASE_PATH + "/mfa"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.status").value("SUCCESS"))
                    .andExpect(jsonPath("$.data", hasSize(2)));

            verify(adminService).listMfaPolicies();
        }

        @Test
        @DisplayName("PUT /mfa/{policyId} - should update an MFA policy")
        void shouldUpdateMfaPolicy() throws Exception {
            UUID policyId = UUID.randomUUID();
            MfaPolicyCreateRequest request = new MfaPolicyCreateRequest(
                    "Updated MFA", "REQUIRED",
                    List.of("TOTP", "FIDO2", "SMS"), 60, 14, true);

            MfaPolicyResponse response = new MfaPolicyResponse(
                    policyId, "Updated MFA", "REQUIRED",
                    List.of("TOTP", "FIDO2", "SMS"), 60, 14, true, "ACTIVE");

            when(adminService.updateMfaPolicy(eq(policyId), any(MfaPolicyCreateRequest.class)))
                    .thenReturn(response);

            mockMvc.perform(put(BASE_PATH + "/mfa/{policyId}", policyId)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.status").value("SUCCESS"))
                    .andExpect(jsonPath("$.data.policyName").value("Updated MFA"))
                    .andExpect(jsonPath("$.data.allowedMethods", hasSize(3)));

            verify(adminService).updateMfaPolicy(eq(policyId), any(MfaPolicyCreateRequest.class));
        }

        @Test
        @DisplayName("DELETE /mfa/{policyId} - should delete an MFA policy")
        void shouldDeleteMfaPolicy() throws Exception {
            UUID policyId = UUID.randomUUID();
            doNothing().when(adminService).deleteMfaPolicy(policyId);

            mockMvc.perform(delete(BASE_PATH + "/mfa/{policyId}", policyId))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.status").value("SUCCESS"));

            verify(adminService).deleteMfaPolicy(policyId);
        }
    }

    // ---- Auth Policies ----

    @Nested
    @DisplayName("Auth Policy CRUD")
    class AuthPolicyCrud {

        @Test
        @DisplayName("POST /auth - should create an auth policy")
        void shouldCreateAuthPolicy() throws Exception {
            AuthPolicyCreateRequest request = new AuthPolicyCreateRequest(
                    "IP Restriction Policy", "Block external IPs",
                    10, "#ip.startsWith('10.')", "ALLOW",
                    false, 1, false);

            UUID policyId = UUID.randomUUID();
            AuthPolicyResponse response = new AuthPolicyResponse(
                    policyId, "IP Restriction Policy", "Block external IPs",
                    10, "#ip.startsWith('10.')", "ALLOW",
                    false, 1, false, "ACTIVE");

            when(adminService.createAuthPolicy(any(AuthPolicyCreateRequest.class)))
                    .thenReturn(response);

            mockMvc.perform(post(BASE_PATH + "/auth")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.status").value("SUCCESS"))
                    .andExpect(jsonPath("$.data.authPolicyId").value(policyId.toString()))
                    .andExpect(jsonPath("$.data.policyName").value("IP Restriction Policy"))
                    .andExpect(jsonPath("$.data.action").value("ALLOW"))
                    .andExpect(jsonPath("$.data.priority").value(10));

            verify(adminService).createAuthPolicy(any(AuthPolicyCreateRequest.class));
        }

        @Test
        @DisplayName("GET /auth/{policyId} - should get an auth policy by ID")
        void shouldGetAuthPolicyById() throws Exception {
            UUID policyId = UUID.randomUUID();
            AuthPolicyResponse response = new AuthPolicyResponse(
                    policyId, "Auth Policy", "A test auth policy",
                    5, "true", "ALLOW", false, 1, true, "ACTIVE");

            when(adminService.getAuthPolicy(policyId)).thenReturn(response);

            mockMvc.perform(get(BASE_PATH + "/auth/{policyId}", policyId))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.status").value("SUCCESS"))
                    .andExpect(jsonPath("$.data.authPolicyId").value(policyId.toString()))
                    .andExpect(jsonPath("$.data.policyName").value("Auth Policy"));

            verify(adminService).getAuthPolicy(policyId);
        }

        @Test
        @DisplayName("GET /auth - should list all auth policies")
        void shouldListAuthPolicies() throws Exception {
            AuthPolicyResponse a1 = new AuthPolicyResponse(
                    UUID.randomUUID(), "Auth A", "First auth policy",
                    1, "true", "ALLOW", false, 1, true, "ACTIVE");
            AuthPolicyResponse a2 = new AuthPolicyResponse(
                    UUID.randomUUID(), "Auth B", "Second auth policy",
                    2, "#risk > 0.8", "DENY", true, 3, false, "ACTIVE");

            when(adminService.listAuthPolicies()).thenReturn(List.of(a1, a2));

            mockMvc.perform(get(BASE_PATH + "/auth"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.status").value("SUCCESS"))
                    .andExpect(jsonPath("$.data", hasSize(2)))
                    .andExpect(jsonPath("$.data[0].policyName").value("Auth A"))
                    .andExpect(jsonPath("$.data[1].policyName").value("Auth B"));

            verify(adminService).listAuthPolicies();
        }

        @Test
        @DisplayName("PUT /auth/{policyId} - should update an auth policy")
        void shouldUpdateAuthPolicy() throws Exception {
            UUID policyId = UUID.randomUUID();
            AuthPolicyCreateRequest request = new AuthPolicyCreateRequest(
                    "Updated Auth Policy", "Updated description",
                    5, "#accountId != null", "ALLOW",
                    true, 2, false);

            AuthPolicyResponse response = new AuthPolicyResponse(
                    policyId, "Updated Auth Policy", "Updated description",
                    5, "#accountId != null", "ALLOW",
                    true, 2, false, "ACTIVE");

            when(adminService.updateAuthPolicy(eq(policyId), any(AuthPolicyCreateRequest.class)))
                    .thenReturn(response);

            mockMvc.perform(put(BASE_PATH + "/auth/{policyId}", policyId)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.status").value("SUCCESS"))
                    .andExpect(jsonPath("$.data.policyName").value("Updated Auth Policy"))
                    .andExpect(jsonPath("$.data.mfaRequired").value(true));

            verify(adminService).updateAuthPolicy(eq(policyId), any(AuthPolicyCreateRequest.class));
        }

        @Test
        @DisplayName("DELETE /auth/{policyId} - should delete an auth policy")
        void shouldDeleteAuthPolicy() throws Exception {
            UUID policyId = UUID.randomUUID();
            doNothing().when(adminService).deleteAuthPolicy(policyId);

            mockMvc.perform(delete(BASE_PATH + "/auth/{policyId}", policyId))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.status").value("SUCCESS"));

            verify(adminService).deleteAuthPolicy(policyId);
        }
    }

    // ---- Policy Bindings ----

    @Nested
    @DisplayName("Policy Bindings")
    class PolicyBindings {

        @Test
        @DisplayName("POST /bindings - should create a policy binding")
        void shouldCreateBinding() throws Exception {
            UUID policyId = UUID.randomUUID();
            UUID targetId = UUID.randomUUID();
            UUID bindingId = UUID.randomUUID();

            PolicyBindingRequest request = new PolicyBindingRequest(
                    "PASSWORD", policyId, "USER", targetId);

            PolicyBindingResponse response = new PolicyBindingResponse(
                    bindingId, "PASSWORD", policyId, "USER", targetId, true);

            when(adminService.createBinding(any(PolicyBindingRequest.class)))
                    .thenReturn(response);

            mockMvc.perform(post(BASE_PATH + "/bindings")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.status").value("SUCCESS"))
                    .andExpect(jsonPath("$.data.bindingId").value(bindingId.toString()))
                    .andExpect(jsonPath("$.data.policyType").value("PASSWORD"))
                    .andExpect(jsonPath("$.data.targetType").value("USER"))
                    .andExpect(jsonPath("$.data.active").value(true));

            verify(adminService).createBinding(any(PolicyBindingRequest.class));
        }

        @Test
        @DisplayName("DELETE /bindings/{bindingId} - should delete a policy binding")
        void shouldDeleteBinding() throws Exception {
            UUID bindingId = UUID.randomUUID();
            doNothing().when(adminService).deleteBinding(bindingId);

            mockMvc.perform(delete(BASE_PATH + "/bindings/{bindingId}", bindingId))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.status").value("SUCCESS"));

            verify(adminService).deleteBinding(bindingId);
        }

        @Test
        @DisplayName("GET /bindings - should list all policy bindings")
        void shouldListBindings() throws Exception {
            PolicyBindingResponse b1 = new PolicyBindingResponse(
                    UUID.randomUUID(), "PASSWORD", UUID.randomUUID(),
                    "USER", UUID.randomUUID(), true);
            PolicyBindingResponse b2 = new PolicyBindingResponse(
                    UUID.randomUUID(), "MFA", UUID.randomUUID(),
                    "GROUP", UUID.randomUUID(), true);

            when(adminService.listBindings()).thenReturn(List.of(b1, b2));

            mockMvc.perform(get(BASE_PATH + "/bindings"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.status").value("SUCCESS"))
                    .andExpect(jsonPath("$.data", hasSize(2)))
                    .andExpect(jsonPath("$.data[0].policyType").value("PASSWORD"))
                    .andExpect(jsonPath("$.data[1].policyType").value("MFA"));

            verify(adminService).listBindings();
        }
    }
}
