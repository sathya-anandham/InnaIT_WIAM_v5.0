package io.innait.wiam.policyservice.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import io.innait.wiam.common.context.TenantContext;
import io.innait.wiam.policyservice.dto.*;
import io.innait.wiam.policyservice.entity.*;
import io.innait.wiam.policyservice.repository.*;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;

import java.util.*;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class PolicyServiceTest {

    @Mock private PasswordPolicyRepository passwordPolicyRepository;
    @Mock private MfaPolicyRepository mfaPolicyRepository;
    @Mock private AuthPolicyRepository authPolicyRepository;
    @Mock private PolicyBindingRepository bindingRepository;
    @Mock private StringRedisTemplate redisTemplate;
    @Mock private ValueOperations<String, String> valueOps;

    private PolicyService policyService;
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final UUID tenantId = UUID.randomUUID();
    private final UUID accountId = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        TenantContext.setTenantId(tenantId);
        lenient().when(redisTemplate.opsForValue()).thenReturn(valueOps);

        policyService = new PolicyService(
                passwordPolicyRepository, mfaPolicyRepository,
                authPolicyRepository, bindingRepository,
                redisTemplate, objectMapper);
    }

    @AfterEach
    void tearDown() {
        TenantContext.clear();
    }

    @Nested
    class ResolvePasswordPolicy {

        @Test
        void shouldResolveFromDirectUserBinding() {
            UUID policyId = UUID.randomUUID();
            PasswordPolicy policy = createPasswordPolicy(policyId, "UserPolicy");

            PolicyBinding userBinding = createBinding(PolicyType.PASSWORD, policyId, TargetType.USER, accountId);

            when(valueOps.get(anyString())).thenReturn(null);
            when(bindingRepository.findBindingsForAccount(eq(PolicyType.PASSWORD), eq(tenantId), eq(accountId), any(), any()))
                    .thenReturn(List.of(userBinding));
            when(passwordPolicyRepository.findById(policyId)).thenReturn(Optional.of(policy));

            PasswordPolicyResponse result = policyService.resolvePasswordPolicy(accountId, List.of(), List.of());

            assertThat(result).isNotNull();
            assertThat(result.policyName()).isEqualTo("UserPolicy");
        }

        @Test
        void shouldFallbackToTenantDefault() {
            PasswordPolicy defaultPolicy = createPasswordPolicy(UUID.randomUUID(), "DefaultPolicy");

            when(valueOps.get(anyString())).thenReturn(null);
            when(bindingRepository.findBindingsForAccount(any(), any(), any(), any(), any()))
                    .thenReturn(List.of());
            when(passwordPolicyRepository.findByTenantIdAndIsDefaultTrueAndStatus(tenantId, PolicyStatus.ACTIVE))
                    .thenReturn(Optional.of(defaultPolicy));

            PasswordPolicyResponse result = policyService.resolvePasswordPolicy(accountId, List.of(), List.of());

            assertThat(result).isNotNull();
            assertThat(result.policyName()).isEqualTo("DefaultPolicy");
        }

        @Test
        void shouldReturnNullWhenNoPolicyFound() {
            when(valueOps.get(anyString())).thenReturn(null);
            when(bindingRepository.findBindingsForAccount(any(), any(), any(), any(), any()))
                    .thenReturn(List.of());
            when(passwordPolicyRepository.findByTenantIdAndIsDefaultTrueAndStatus(tenantId, PolicyStatus.ACTIVE))
                    .thenReturn(Optional.empty());

            PasswordPolicyResponse result = policyService.resolvePasswordPolicy(accountId, List.of(), List.of());

            assertThat(result).isNull();
        }

        @Test
        void shouldCacheResolvedPolicy() {
            UUID policyId = UUID.randomUUID();
            PasswordPolicy policy = createPasswordPolicy(policyId, "CachedPolicy");
            PolicyBinding binding = createBinding(PolicyType.PASSWORD, policyId, TargetType.USER, accountId);

            when(valueOps.get(anyString())).thenReturn(null);
            when(bindingRepository.findBindingsForAccount(any(), any(), any(), any(), any()))
                    .thenReturn(List.of(binding));
            when(passwordPolicyRepository.findById(policyId)).thenReturn(Optional.of(policy));

            policyService.resolvePasswordPolicy(accountId, List.of(), List.of());

            verify(valueOps).set(anyString(), anyString(), any(java.time.Duration.class));
        }

        @Test
        void shouldReturnCachedPolicyOnHit() throws Exception {
            PasswordPolicyResponse cached = new PasswordPolicyResponse(
                    UUID.randomUUID(), "CachedPolicy", 12, 128,
                    true, true, true, true, 3, 12, 90, 1, 5, 30, false, "ACTIVE");

            when(valueOps.get(anyString())).thenReturn(objectMapper.writeValueAsString(cached));

            PasswordPolicyResponse result = policyService.resolvePasswordPolicy(accountId, List.of(), List.of());

            assertThat(result).isNotNull();
            assertThat(result.policyName()).isEqualTo("CachedPolicy");
            verify(bindingRepository, never()).findBindingsForAccount(any(), any(), any(), any(), any());
        }
    }

    @Nested
    class BindingHierarchy {

        @Test
        void shouldPreferUserOverGroupBinding() {
            UUID userPolicyId = UUID.randomUUID();
            UUID groupPolicyId = UUID.randomUUID();
            UUID groupId = UUID.randomUUID();

            PasswordPolicy userPolicy = createPasswordPolicy(userPolicyId, "UserPolicy");
            PolicyBinding userBinding = createBinding(PolicyType.PASSWORD, userPolicyId, TargetType.USER, accountId);
            PolicyBinding groupBinding = createBinding(PolicyType.PASSWORD, groupPolicyId, TargetType.GROUP, groupId);

            when(valueOps.get(anyString())).thenReturn(null);
            when(bindingRepository.findBindingsForAccount(any(), any(), any(), any(), any()))
                    .thenReturn(List.of(groupBinding, userBinding)); // deliberately out of order
            when(passwordPolicyRepository.findById(userPolicyId)).thenReturn(Optional.of(userPolicy));

            PasswordPolicyResponse result = policyService.resolvePasswordPolicy(accountId, List.of(groupId), List.of());

            assertThat(result.policyName()).isEqualTo("UserPolicy");
        }

        @Test
        void shouldPreferGroupOverRoleBinding() {
            UUID groupPolicyId = UUID.randomUUID();
            UUID rolePolicyId = UUID.randomUUID();
            UUID groupId = UUID.randomUUID();
            UUID roleId = UUID.randomUUID();

            PasswordPolicy groupPolicy = createPasswordPolicy(groupPolicyId, "GroupPolicy");
            PolicyBinding groupBinding = createBinding(PolicyType.PASSWORD, groupPolicyId, TargetType.GROUP, groupId);
            PolicyBinding roleBinding = createBinding(PolicyType.PASSWORD, rolePolicyId, TargetType.ROLE, roleId);

            when(valueOps.get(anyString())).thenReturn(null);
            when(bindingRepository.findBindingsForAccount(any(), any(), any(), any(), any()))
                    .thenReturn(List.of(roleBinding, groupBinding));
            when(passwordPolicyRepository.findById(groupPolicyId)).thenReturn(Optional.of(groupPolicy));

            PasswordPolicyResponse result = policyService.resolvePasswordPolicy(accountId, List.of(groupId), List.of(roleId));

            assertThat(result.policyName()).isEqualTo("GroupPolicy");
        }

        @Test
        void shouldPreferRoleOverTenantBinding() {
            UUID rolePolicyId = UUID.randomUUID();
            UUID tenantPolicyId = UUID.randomUUID();
            UUID roleId = UUID.randomUUID();

            PasswordPolicy rolePolicy = createPasswordPolicy(rolePolicyId, "RolePolicy");
            PolicyBinding roleBinding = createBinding(PolicyType.PASSWORD, rolePolicyId, TargetType.ROLE, roleId);
            PolicyBinding tenantBinding = createBinding(PolicyType.PASSWORD, tenantPolicyId, TargetType.TENANT, tenantId);

            when(valueOps.get(anyString())).thenReturn(null);
            when(bindingRepository.findBindingsForAccount(any(), any(), any(), any(), any()))
                    .thenReturn(List.of(tenantBinding, roleBinding));
            when(passwordPolicyRepository.findById(rolePolicyId)).thenReturn(Optional.of(rolePolicy));

            PasswordPolicyResponse result = policyService.resolvePasswordPolicy(accountId, List.of(), List.of(roleId));

            assertThat(result.policyName()).isEqualTo("RolePolicy");
        }
    }

    @Nested
    class ResolveMfaPolicy {

        @Test
        void shouldResolveMfaPolicyFromBinding() {
            UUID policyId = UUID.randomUUID();
            MfaPolicy policy = createMfaPolicy(policyId, "StrictMfa", EnforcementMode.REQUIRED);

            PolicyBinding binding = createBinding(PolicyType.MFA, policyId, TargetType.USER, accountId);

            when(valueOps.get(anyString())).thenReturn(null);
            when(bindingRepository.findBindingsForAccount(eq(PolicyType.MFA), any(), any(), any(), any()))
                    .thenReturn(List.of(binding));
            when(mfaPolicyRepository.findById(policyId)).thenReturn(Optional.of(policy));

            MfaPolicyResponse result = policyService.resolveMfaPolicy(accountId, List.of(), List.of());

            assertThat(result).isNotNull();
            assertThat(result.enforcementMode()).isEqualTo("REQUIRED");
            assertThat(result.policyName()).isEqualTo("StrictMfa");
        }

        @Test
        void shouldParseMfaAllowedMethods() {
            UUID policyId = UUID.randomUUID();
            MfaPolicy policy = createMfaPolicy(policyId, "WithMethods", EnforcementMode.OPTIONAL);
            policy.setAllowedMethods("[\"TOTP\",\"FIDO\",\"PUSH\"]");

            PolicyBinding binding = createBinding(PolicyType.MFA, policyId, TargetType.USER, accountId);

            when(valueOps.get(anyString())).thenReturn(null);
            when(bindingRepository.findBindingsForAccount(any(), any(), any(), any(), any()))
                    .thenReturn(List.of(binding));
            when(mfaPolicyRepository.findById(policyId)).thenReturn(Optional.of(policy));

            MfaPolicyResponse result = policyService.resolveMfaPolicy(accountId, List.of(), List.of());

            assertThat(result.allowedMethods()).containsExactly("TOTP", "FIDO", "PUSH");
        }
    }

    @Nested
    class ResolveAuthPolicy {

        @Test
        void shouldMatchSpelExpressionAndReturnAction() {
            AuthPolicy policy = createAuthPolicy("DenyRule", "#ip == '10.0.0.1'", PolicyAction.DENY, 100);
            policy.setDefault(true);

            when(authPolicyRepository.findByTenantIdAndStatusOrderByPriorityAsc(tenantId, PolicyStatus.ACTIVE))
                    .thenReturn(List.of(policy));
            when(bindingRepository.findBindingsForAccount(any(), any(), any(), any(), any()))
                    .thenReturn(List.of());

            Map<String, Object> context = Map.of("ip", "10.0.0.1");
            AuthPolicyResult result = policyService.resolveAuthPolicy(accountId, List.of(), List.of(), context);

            assertThat(result.action()).isEqualTo("DENY");
            assertThat(result.matchedPolicyName()).isEqualTo("DenyRule");
        }

        @Test
        void shouldReturnAllowWhenNoRulesMatch() {
            AuthPolicy policy = createAuthPolicy("NeverMatch", "#ip == 'impossible'", PolicyAction.DENY, 100);
            policy.setDefault(true);

            when(authPolicyRepository.findByTenantIdAndStatusOrderByPriorityAsc(tenantId, PolicyStatus.ACTIVE))
                    .thenReturn(List.of(policy));
            when(bindingRepository.findBindingsForAccount(any(), any(), any(), any(), any()))
                    .thenReturn(List.of());

            AuthPolicyResult result = policyService.resolveAuthPolicy(accountId, List.of(), List.of(), Map.of("ip", "192.168.1.1"));

            assertThat(result.action()).isEqualTo("ALLOW");
            assertThat(result.matchedPolicyId()).isNull();
        }

        @Test
        void shouldRespectPriorityOrder() {
            AuthPolicy highPriority = createAuthPolicy("HighPri", "true", PolicyAction.MFA_STEPUP, 10);
            highPriority.setDefault(true);
            AuthPolicy lowPriority = createAuthPolicy("LowPri", "true", PolicyAction.DENY, 100);
            lowPriority.setDefault(true);

            when(authPolicyRepository.findByTenantIdAndStatusOrderByPriorityAsc(tenantId, PolicyStatus.ACTIVE))
                    .thenReturn(List.of(highPriority, lowPriority)); // ordered by priority
            when(bindingRepository.findBindingsForAccount(any(), any(), any(), any(), any()))
                    .thenReturn(List.of());

            AuthPolicyResult result = policyService.resolveAuthPolicy(accountId, List.of(), List.of(), null);

            assertThat(result.action()).isEqualTo("MFA_STEPUP");
            assertThat(result.matchedPolicyName()).isEqualTo("HighPri");
        }

        @Test
        void shouldSkipPoliciesNotBoundToAccount() {
            AuthPolicy unboundPolicy = createAuthPolicy("Unbound", "true", PolicyAction.DENY, 10);
            // Not default and not bound

            when(authPolicyRepository.findByTenantIdAndStatusOrderByPriorityAsc(tenantId, PolicyStatus.ACTIVE))
                    .thenReturn(List.of(unboundPolicy));
            when(bindingRepository.findBindingsForAccount(any(), any(), any(), any(), any()))
                    .thenReturn(List.of()); // No bindings for this account

            AuthPolicyResult result = policyService.resolveAuthPolicy(accountId, List.of(), List.of(), null);

            assertThat(result.action()).isEqualTo("ALLOW"); // Falls through to default
        }

        @Test
        void shouldReturnMfaRequiredFromMatchedPolicy() {
            AuthPolicy policy = createAuthPolicy("MfaForVpn", "#channel == 'vpn'", PolicyAction.ALLOW, 50);
            policy.setDefault(true);
            policy.setMfaRequired(true);
            policy.setRequiredAuthLevel(2);

            when(authPolicyRepository.findByTenantIdAndStatusOrderByPriorityAsc(tenantId, PolicyStatus.ACTIVE))
                    .thenReturn(List.of(policy));
            when(bindingRepository.findBindingsForAccount(any(), any(), any(), any(), any()))
                    .thenReturn(List.of());

            AuthPolicyResult result = policyService.resolveAuthPolicy(accountId, List.of(), List.of(), Map.of("channel", "vpn"));

            assertThat(result.mfaRequired()).isTrue();
            assertThat(result.requiredAuthLevel()).isEqualTo(2);
        }

        @Test
        void shouldHandleSpelEvaluationErrors() {
            AuthPolicy badPolicy = createAuthPolicy("BadSpel", "#nonexistent.method()", PolicyAction.DENY, 10);
            badPolicy.setDefault(true);
            AuthPolicy goodPolicy = createAuthPolicy("GoodPolicy", "true", PolicyAction.ALLOW, 20);
            goodPolicy.setDefault(true);

            when(authPolicyRepository.findByTenantIdAndStatusOrderByPriorityAsc(tenantId, PolicyStatus.ACTIVE))
                    .thenReturn(List.of(badPolicy, goodPolicy));
            when(bindingRepository.findBindingsForAccount(any(), any(), any(), any(), any()))
                    .thenReturn(List.of());

            AuthPolicyResult result = policyService.resolveAuthPolicy(accountId, List.of(), List.of(), null);

            // Bad policy is skipped, good policy matches
            assertThat(result.action()).isEqualTo("ALLOW");
            assertThat(result.matchedPolicyName()).isEqualTo("GoodPolicy");
        }

        @Test
        void shouldExposeAccountIdAndTenantIdInSpel() {
            AuthPolicy policy = createAuthPolicy("AccountCheck",
                    "#accountId != null && #tenantId != null", PolicyAction.ALLOW, 10);
            policy.setDefault(true);

            when(authPolicyRepository.findByTenantIdAndStatusOrderByPriorityAsc(tenantId, PolicyStatus.ACTIVE))
                    .thenReturn(List.of(policy));
            when(bindingRepository.findBindingsForAccount(any(), any(), any(), any(), any()))
                    .thenReturn(List.of());

            AuthPolicyResult result = policyService.resolveAuthPolicy(accountId, List.of(), List.of(), null);

            assertThat(result.action()).isEqualTo("ALLOW");
            assertThat(result.matchedPolicyName()).isEqualTo("AccountCheck");
        }
    }

    // ---- Helpers ----

    private PasswordPolicy createPasswordPolicy(UUID id, String name) {
        PasswordPolicy p = new PasswordPolicy();
        p.setPasswordPolicyId(id);
        p.setTenantId(tenantId);
        p.setPolicyName(name);
        p.setMinLength(12);
        p.setMaxLength(128);
        p.setRequireUppercase(true);
        p.setRequireLowercase(true);
        p.setRequireDigit(true);
        p.setRequireSpecial(true);
        p.setMaxRepeatedChars(3);
        p.setHistoryCount(12);
        p.setMaxAgeDays(90);
        p.setMinAgeDays(1);
        p.setLockoutThreshold(5);
        p.setLockoutDurationMin(30);
        p.setStatus(PolicyStatus.ACTIVE);
        return p;
    }

    private MfaPolicy createMfaPolicy(UUID id, String name, EnforcementMode mode) {
        MfaPolicy p = new MfaPolicy();
        p.setMfaPolicyId(id);
        p.setTenantId(tenantId);
        p.setPolicyName(name);
        p.setEnforcementMode(mode);
        p.setAllowedMethods("[\"TOTP\",\"FIDO\"]");
        p.setRememberDeviceDays(30);
        p.setGracePeriodDays(7);
        p.setStatus(PolicyStatus.ACTIVE);
        return p;
    }

    private AuthPolicy createAuthPolicy(String name, String ruleExpression, PolicyAction action, int priority) {
        AuthPolicy p = new AuthPolicy();
        p.setAuthPolicyId(UUID.randomUUID());
        p.setTenantId(tenantId);
        p.setPolicyName(name);
        p.setPriority(priority);
        p.setRuleExpression(ruleExpression);
        p.setAction(action);
        p.setMfaRequired(false);
        p.setRequiredAuthLevel(1);
        p.setDefault(false);
        p.setStatus(PolicyStatus.ACTIVE);
        return p;
    }

    private PolicyBinding createBinding(PolicyType policyType, UUID policyId, TargetType targetType, UUID targetId) {
        PolicyBinding b = new PolicyBinding();
        b.setBindingId(UUID.randomUUID());
        b.setTenantId(tenantId);
        b.setPolicyType(policyType);
        b.setPolicyId(policyId);
        b.setTargetType(targetType);
        b.setTargetId(targetId);
        b.setActive(true);
        return b;
    }
}
