package io.innait.wiam.policyservice.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import io.innait.wiam.policyservice.dto.*;
import io.innait.wiam.policyservice.service.PolicyAdminService;
import io.innait.wiam.policyservice.service.PolicyService;
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
import java.util.Map;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(PolicyResolveController.class)
@AutoConfigureMockMvc(addFilters = false)
class PolicyResolveControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private PolicyService policyService;

    @MockBean
    private PolicyAdminService policyAdminService;

    private static final String BASE_PATH = "/api/v1/policies/resolve";

    // ---- Resolve Password Policy ----

    @Nested
    @DisplayName("GET /resolve/password")
    class ResolvePasswordPolicy {

        @Test
        @DisplayName("should resolve password policy for a given accountId")
        void shouldResolvePasswordPolicy() throws Exception {
            UUID accountId = UUID.randomUUID();
            UUID policyId = UUID.randomUUID();

            PasswordPolicyResponse response = new PasswordPolicyResponse(
                    policyId, "Default Password Policy",
                    8, 128, true, true, true, true,
                    3, 5, 90, 1, 5, 30, true, "ACTIVE");

            when(policyService.resolvePasswordPolicy(eq(accountId), isNull(), isNull()))
                    .thenReturn(response);

            mockMvc.perform(get(BASE_PATH + "/password")
                            .param("accountId", accountId.toString()))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.status").value("SUCCESS"))
                    .andExpect(jsonPath("$.data.passwordPolicyId").value(policyId.toString()))
                    .andExpect(jsonPath("$.data.policyName").value("Default Password Policy"))
                    .andExpect(jsonPath("$.data.minLength").value(8))
                    .andExpect(jsonPath("$.data.requireUppercase").value(true))
                    .andExpect(jsonPath("$.data.status").value("ACTIVE"));

            verify(policyService).resolvePasswordPolicy(eq(accountId), isNull(), isNull());
        }

        @Test
        @DisplayName("should resolve password policy with groupIds and roleIds")
        void shouldResolvePasswordPolicyWithGroupsAndRoles() throws Exception {
            UUID accountId = UUID.randomUUID();
            UUID groupId = UUID.randomUUID();
            UUID roleId = UUID.randomUUID();
            UUID policyId = UUID.randomUUID();

            PasswordPolicyResponse response = new PasswordPolicyResponse(
                    policyId, "Group Password Policy",
                    12, 64, true, true, true, false,
                    2, 10, 60, 1, 3, 15, false, "ACTIVE");

            when(policyService.resolvePasswordPolicy(eq(accountId), eq(List.of(groupId)), eq(List.of(roleId))))
                    .thenReturn(response);

            mockMvc.perform(get(BASE_PATH + "/password")
                            .param("accountId", accountId.toString())
                            .param("groupIds", groupId.toString())
                            .param("roleIds", roleId.toString()))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.status").value("SUCCESS"))
                    .andExpect(jsonPath("$.data.policyName").value("Group Password Policy"))
                    .andExpect(jsonPath("$.data.minLength").value(12));
        }

        @Test
        @DisplayName("should return 400 when accountId is missing")
        void shouldReturn400WhenAccountIdMissing() throws Exception {
            mockMvc.perform(get(BASE_PATH + "/password"))
                    .andExpect(status().isBadRequest());

            verifyNoInteractions(policyService);
        }
    }

    // ---- Resolve MFA Policy ----

    @Nested
    @DisplayName("GET /resolve/mfa")
    class ResolveMfaPolicy {

        @Test
        @DisplayName("should resolve MFA policy for a given accountId")
        void shouldResolveMfaPolicy() throws Exception {
            UUID accountId = UUID.randomUUID();
            UUID policyId = UUID.randomUUID();

            MfaPolicyResponse response = new MfaPolicyResponse(
                    policyId, "Default MFA Policy", "REQUIRED",
                    List.of("TOTP", "FIDO2"), 30, 7, true, "ACTIVE");

            when(policyService.resolveMfaPolicy(eq(accountId), isNull(), isNull()))
                    .thenReturn(response);

            mockMvc.perform(get(BASE_PATH + "/mfa")
                            .param("accountId", accountId.toString()))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.status").value("SUCCESS"))
                    .andExpect(jsonPath("$.data.mfaPolicyId").value(policyId.toString()))
                    .andExpect(jsonPath("$.data.policyName").value("Default MFA Policy"))
                    .andExpect(jsonPath("$.data.enforcementMode").value("REQUIRED"))
                    .andExpect(jsonPath("$.data.allowedMethods[0]").value("TOTP"))
                    .andExpect(jsonPath("$.data.allowedMethods[1]").value("FIDO2"));

            verify(policyService).resolveMfaPolicy(eq(accountId), isNull(), isNull());
        }
    }

    // ---- Resolve Auth Policy ----

    @Nested
    @DisplayName("GET /resolve/auth")
    class ResolveAuthPolicy {

        @Test
        @DisplayName("should resolve auth policy for a given accountId")
        void shouldResolveAuthPolicy() throws Exception {
            UUID accountId = UUID.randomUUID();
            UUID matchedPolicyId = UUID.randomUUID();

            AuthPolicyResult result = new AuthPolicyResult(
                    "ALLOW", false, 1,
                    matchedPolicyId, "Default Auth Policy", "true");

            when(policyService.resolveAuthPolicy(eq(accountId), isNull(), isNull(), any()))
                    .thenReturn(result);

            mockMvc.perform(get(BASE_PATH + "/auth")
                            .param("accountId", accountId.toString()))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.status").value("SUCCESS"))
                    .andExpect(jsonPath("$.data.action").value("ALLOW"))
                    .andExpect(jsonPath("$.data.mfaRequired").value(false))
                    .andExpect(jsonPath("$.data.requiredAuthLevel").value(1))
                    .andExpect(jsonPath("$.data.matchedPolicyId").value(matchedPolicyId.toString()));

            verify(policyService).resolveAuthPolicy(eq(accountId), isNull(), isNull(), any());
        }

        @Test
        @DisplayName("should return 400 when accountId is missing for auth resolve")
        void shouldReturn400WhenAccountIdMissingForAuth() throws Exception {
            mockMvc.perform(get(BASE_PATH + "/auth"))
                    .andExpect(status().isBadRequest());

            verifyNoInteractions(policyService);
        }
    }

    // ---- Simulate ----

    @Nested
    @DisplayName("POST /resolve/simulate")
    class Simulate {

        @Test
        @DisplayName("should simulate policy resolution")
        void shouldSimulatePolicyResolution() throws Exception {
            UUID accountId = UUID.randomUUID();
            UUID groupId = UUID.randomUUID();

            PolicySimulateRequest request = new PolicySimulateRequest(
                    accountId, List.of(groupId), List.of(), Map.of("ip", "10.0.0.1"));

            PasswordPolicyResponse pwdResponse = new PasswordPolicyResponse(
                    UUID.randomUUID(), "Simulated PWD Policy",
                    10, 128, true, true, true, true,
                    3, 5, 90, 1, 5, 30, true, "ACTIVE");

            MfaPolicyResponse mfaResponse = new MfaPolicyResponse(
                    UUID.randomUUID(), "Simulated MFA Policy", "OPTIONAL",
                    List.of("TOTP"), 14, 3, false, "ACTIVE");

            AuthPolicyResult authResult = new AuthPolicyResult(
                    "ALLOW", true, 2, UUID.randomUUID(), "Simulated Auth Policy", "#ip == '10.0.0.1'");

            PolicySimulateResponse simulateResponse = new PolicySimulateResponse(
                    pwdResponse, mfaResponse, authResult);

            when(policyAdminService.simulate(any(PolicySimulateRequest.class)))
                    .thenReturn(simulateResponse);

            mockMvc.perform(post(BASE_PATH + "/simulate")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.status").value("SUCCESS"))
                    .andExpect(jsonPath("$.data.resolvedPasswordPolicy.policyName").value("Simulated PWD Policy"))
                    .andExpect(jsonPath("$.data.resolvedMfaPolicy.policyName").value("Simulated MFA Policy"))
                    .andExpect(jsonPath("$.data.resolvedAuthPolicy.action").value("ALLOW"));

            verify(policyAdminService).simulate(any(PolicySimulateRequest.class));
        }
    }
}
