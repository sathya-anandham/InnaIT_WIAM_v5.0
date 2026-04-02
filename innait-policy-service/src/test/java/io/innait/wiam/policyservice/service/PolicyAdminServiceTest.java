package io.innait.wiam.policyservice.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import io.innait.wiam.common.context.TenantContext;
import io.innait.wiam.common.kafka.EventPublisher;
import io.innait.wiam.policyservice.dto.*;
import io.innait.wiam.policyservice.entity.*;
import io.innait.wiam.policyservice.repository.*;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class PolicyAdminServiceTest {

    @Mock private PasswordPolicyRepository passwordPolicyRepository;
    @Mock private MfaPolicyRepository mfaPolicyRepository;
    @Mock private AuthPolicyRepository authPolicyRepository;
    @Mock private PolicyBindingRepository bindingRepository;
    @Mock private EventPublisher eventPublisher;
    @Mock private StringRedisTemplate redisTemplate;
    @Mock private ValueOperations<String, String> valueOps;

    private PolicyAdminService adminService;
    private PolicyService policyService;
    private final UUID tenantId = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        TenantContext.setTenantId(tenantId);
        lenient().when(redisTemplate.opsForValue()).thenReturn(valueOps);
        ObjectMapper objectMapper = new ObjectMapper();

        policyService = new PolicyService(
                passwordPolicyRepository, mfaPolicyRepository,
                authPolicyRepository, bindingRepository,
                redisTemplate, objectMapper);

        adminService = new PolicyAdminService(
                passwordPolicyRepository, mfaPolicyRepository,
                authPolicyRepository, bindingRepository,
                eventPublisher, objectMapper, policyService);
    }

    @AfterEach
    void tearDown() {
        TenantContext.clear();
    }

    @Nested
    class PasswordPolicyCrud {

        @Test
        void shouldCreatePasswordPolicy() {
            when(passwordPolicyRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            PasswordPolicyCreateRequest request = new PasswordPolicyCreateRequest(
                    "StrongPolicy", 14, 128, true, true, true, true,
                    3, 24, 90, 1, 5, 30, false);

            PasswordPolicyResponse result = adminService.createPasswordPolicy(request);

            assertThat(result.policyName()).isEqualTo("StrongPolicy");
            assertThat(result.minLength()).isEqualTo(14);
            assertThat(result.status()).isEqualTo("ACTIVE");

            ArgumentCaptor<PasswordPolicy> captor = ArgumentCaptor.forClass(PasswordPolicy.class);
            verify(passwordPolicyRepository).save(captor.capture());
            assertThat(captor.getValue().getTenantId()).isEqualTo(tenantId);
        }

        @Test
        void shouldUpdatePasswordPolicy() {
            UUID policyId = UUID.randomUUID();
            PasswordPolicy existing = new PasswordPolicy();
            existing.setPasswordPolicyId(policyId);
            existing.setTenantId(tenantId);
            existing.setStatus(PolicyStatus.ACTIVE);

            when(passwordPolicyRepository.findById(policyId)).thenReturn(Optional.of(existing));
            when(passwordPolicyRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            PasswordPolicyCreateRequest request = new PasswordPolicyCreateRequest(
                    "UpdatedPolicy", 16, 64, true, true, true, true,
                    2, 12, 60, 2, 3, 60, true);

            PasswordPolicyResponse result = adminService.updatePasswordPolicy(policyId, request);

            assertThat(result.policyName()).isEqualTo("UpdatedPolicy");
            assertThat(result.minLength()).isEqualTo(16);
            verify(eventPublisher).publish(eq("innait.policy.policy.updated"), any());
        }

        @Test
        void shouldSoftDeletePasswordPolicy() {
            UUID policyId = UUID.randomUUID();
            PasswordPolicy policy = new PasswordPolicy();
            policy.setPasswordPolicyId(policyId);
            policy.setTenantId(tenantId);
            policy.setStatus(PolicyStatus.ACTIVE);

            when(passwordPolicyRepository.findById(policyId)).thenReturn(Optional.of(policy));
            when(passwordPolicyRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            adminService.deletePasswordPolicy(policyId);

            assertThat(policy.getStatus()).isEqualTo(PolicyStatus.INACTIVE);
        }

        @Test
        void shouldListActivePasswordPolicies() {
            PasswordPolicy p1 = new PasswordPolicy();
            p1.setPasswordPolicyId(UUID.randomUUID());
            p1.setTenantId(tenantId);
            p1.setPolicyName("Policy1");
            p1.setStatus(PolicyStatus.ACTIVE);

            when(passwordPolicyRepository.findByTenantIdAndStatus(tenantId, PolicyStatus.ACTIVE))
                    .thenReturn(List.of(p1));

            List<PasswordPolicyResponse> result = adminService.listPasswordPolicies();

            assertThat(result).hasSize(1);
            assertThat(result.get(0).policyName()).isEqualTo("Policy1");
        }
    }

    @Nested
    class MfaPolicyCrud {

        @Test
        void shouldCreateMfaPolicy() {
            when(mfaPolicyRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            MfaPolicyCreateRequest request = new MfaPolicyCreateRequest(
                    "RequiredMfa", "REQUIRED", List.of("TOTP", "FIDO"), 30, 7, true);

            MfaPolicyResponse result = adminService.createMfaPolicy(request);

            assertThat(result.policyName()).isEqualTo("RequiredMfa");
            assertThat(result.enforcementMode()).isEqualTo("REQUIRED");
            assertThat(result.allowedMethods()).containsExactly("TOTP", "FIDO");
        }

        @Test
        void shouldUpdateMfaPolicy() {
            UUID policyId = UUID.randomUUID();
            MfaPolicy existing = new MfaPolicy();
            existing.setMfaPolicyId(policyId);
            existing.setTenantId(tenantId);
            existing.setStatus(PolicyStatus.ACTIVE);

            when(mfaPolicyRepository.findById(policyId)).thenReturn(Optional.of(existing));
            when(mfaPolicyRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            MfaPolicyCreateRequest request = new MfaPolicyCreateRequest(
                    "AdaptiveMfa", "ADAPTIVE", List.of("PUSH"), 14, 3, false);

            MfaPolicyResponse result = adminService.updateMfaPolicy(policyId, request);

            assertThat(result.enforcementMode()).isEqualTo("ADAPTIVE");
        }
    }

    @Nested
    class AuthPolicyCrud {

        @Test
        void shouldCreateAuthPolicy() {
            when(authPolicyRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            AuthPolicyCreateRequest request = new AuthPolicyCreateRequest(
                    "DenyVpn", "Block VPN access", 10,
                    "#channel == 'vpn'", "DENY", false, 1, false);

            AuthPolicyResponse result = adminService.createAuthPolicy(request);

            assertThat(result.policyName()).isEqualTo("DenyVpn");
            assertThat(result.action()).isEqualTo("DENY");
            assertThat(result.ruleExpression()).isEqualTo("#channel == 'vpn'");
        }

        @Test
        void shouldUpdateAuthPolicy() {
            UUID policyId = UUID.randomUUID();
            AuthPolicy existing = new AuthPolicy();
            existing.setAuthPolicyId(policyId);
            existing.setTenantId(tenantId);
            existing.setStatus(PolicyStatus.ACTIVE);

            when(authPolicyRepository.findById(policyId)).thenReturn(Optional.of(existing));
            when(authPolicyRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            AuthPolicyCreateRequest request = new AuthPolicyCreateRequest(
                    "Updated", "Revised", 50,
                    "true", "MFA_STEPUP", true, 2, false);

            AuthPolicyResponse result = adminService.updateAuthPolicy(policyId, request);

            assertThat(result.policyName()).isEqualTo("Updated");
            assertThat(result.action()).isEqualTo("MFA_STEPUP");
            assertThat(result.mfaRequired()).isTrue();
        }
    }

    @Nested
    class PolicyBindingsCrud {

        @Test
        void shouldCreateBinding() {
            when(bindingRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            PolicyBindingRequest request = new PolicyBindingRequest(
                    "PASSWORD", UUID.randomUUID(), "USER", UUID.randomUUID());

            PolicyBindingResponse result = adminService.createBinding(request);

            assertThat(result.bindingId()).isNotNull();
            assertThat(result.policyType()).isEqualTo("PASSWORD");
            assertThat(result.targetType()).isEqualTo("USER");
            assertThat(result.active()).isTrue();
        }

        @Test
        void shouldDeactivateBinding() {
            UUID bindingId = UUID.randomUUID();
            PolicyBinding binding = new PolicyBinding();
            binding.setBindingId(bindingId);
            binding.setActive(true);

            when(bindingRepository.findById(bindingId)).thenReturn(Optional.of(binding));
            when(bindingRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            adminService.deleteBinding(bindingId);

            assertThat(binding.isActive()).isFalse();
        }
    }

    @Nested
    class Simulate {

        @Test
        void shouldReturnResolvedPoliciesForAccount() {
            UUID accountId = UUID.randomUUID();

            when(valueOps.get(anyString())).thenReturn(null);
            when(bindingRepository.findBindingsForAccount(any(), any(), any(), any(), any()))
                    .thenReturn(List.of());
            when(passwordPolicyRepository.findByTenantIdAndIsDefaultTrueAndStatus(tenantId, PolicyStatus.ACTIVE))
                    .thenReturn(Optional.empty());
            when(mfaPolicyRepository.findByTenantIdAndIsDefaultTrueAndStatus(tenantId, PolicyStatus.ACTIVE))
                    .thenReturn(Optional.empty());
            when(authPolicyRepository.findByTenantIdAndStatusOrderByPriorityAsc(tenantId, PolicyStatus.ACTIVE))
                    .thenReturn(List.of());

            PolicySimulateRequest request = new PolicySimulateRequest(
                    accountId, List.of(), List.of(), null);

            PolicySimulateResponse result = adminService.simulate(request);

            assertThat(result).isNotNull();
            assertThat(result.resolvedAuthPolicy()).isNotNull();
            assertThat(result.resolvedAuthPolicy().action()).isEqualTo("ALLOW");
        }
    }
}
