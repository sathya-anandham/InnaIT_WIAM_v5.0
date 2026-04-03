package io.innait.wiam.policyservice.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.innait.wiam.common.context.TenantContext;
import io.innait.wiam.common.redis.RedisCacheKeys;
import io.innait.wiam.policyservice.dto.*;
import io.innait.wiam.policyservice.entity.*;
import io.innait.wiam.policyservice.repository.*;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.expression.EvaluationContext;
import org.springframework.expression.ExpressionParser;
import org.springframework.expression.spel.standard.SpelExpressionParser;
import org.springframework.expression.spel.support.StandardEvaluationContext;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.*;

@Service
public class PolicyService {

    private static final long CACHE_TTL_SECONDS = RedisCacheKeys.POLICY_CACHE_TTL;

    /**
     * Binding resolution priority: USER > GROUP > ROLE > ORG_UNIT > APPLICATION > TENANT
     * Lower index = higher priority.
     */
    private static final List<TargetType> PRIORITY_ORDER = List.of(
            TargetType.USER,
            TargetType.GROUP,
            TargetType.ROLE,
            TargetType.ORG_UNIT,
            TargetType.APPLICATION,
            TargetType.TENANT
    );

    private final PasswordPolicyRepository passwordPolicyRepository;
    private final MfaPolicyRepository mfaPolicyRepository;
    private final AuthPolicyRepository authPolicyRepository;
    private final PolicyBindingRepository bindingRepository;
    private final StringRedisTemplate redisTemplate;
    private final ObjectMapper objectMapper;
    private final ExpressionParser spelParser = new SpelExpressionParser();

    public PolicyService(PasswordPolicyRepository passwordPolicyRepository,
                         MfaPolicyRepository mfaPolicyRepository,
                         AuthPolicyRepository authPolicyRepository,
                         PolicyBindingRepository bindingRepository,
                         StringRedisTemplate redisTemplate,
                         ObjectMapper objectMapper) {
        this.passwordPolicyRepository = passwordPolicyRepository;
        this.mfaPolicyRepository = mfaPolicyRepository;
        this.authPolicyRepository = authPolicyRepository;
        this.bindingRepository = bindingRepository;
        this.redisTemplate = redisTemplate;
        this.objectMapper = objectMapper;
    }

    public PasswordPolicyResponse resolvePasswordPolicy(UUID accountId, List<UUID> groupIds, List<UUID> roleIds) {
        UUID tenantId = TenantContext.requireTenantId();

        // Check Redis cache
        String cacheKey = RedisCacheKeys.policyKey(tenantId, "password:" + accountId);
        PasswordPolicyResponse cached = readFromCache(cacheKey, PasswordPolicyResponse.class);
        if (cached != null) return cached;

        // Resolve through binding hierarchy
        List<PolicyBinding> bindings = bindingRepository.findBindingsForAccount(
                PolicyType.PASSWORD, tenantId, accountId,
                groupIds != null ? groupIds : List.of(),
                roleIds != null ? roleIds : List.of());

        UUID policyId = resolveByPriority(bindings);

        PasswordPolicy policy;
        if (policyId != null) {
            policy = passwordPolicyRepository.findById(policyId).orElse(null);
        } else {
            // Fallback to tenant default
            policy = passwordPolicyRepository.findByTenantIdAndIsDefaultTrueAndStatus(tenantId, PolicyStatus.ACTIVE)
                    .orElse(null);
        }

        if (policy == null) return null;

        PasswordPolicyResponse response = toPasswordPolicyResponse(policy);
        writeToCache(cacheKey, response);
        return response;
    }

    public MfaPolicyResponse resolveMfaPolicy(UUID accountId, List<UUID> groupIds, List<UUID> roleIds) {
        UUID tenantId = TenantContext.requireTenantId();

        String cacheKey = RedisCacheKeys.policyKey(tenantId, "mfa:" + accountId);
        MfaPolicyResponse cached = readFromCache(cacheKey, MfaPolicyResponse.class);
        if (cached != null) return cached;

        List<PolicyBinding> bindings = bindingRepository.findBindingsForAccount(
                PolicyType.MFA, tenantId, accountId,
                groupIds != null ? groupIds : List.of(),
                roleIds != null ? roleIds : List.of());

        UUID policyId = resolveByPriority(bindings);

        MfaPolicy policy;
        if (policyId != null) {
            policy = mfaPolicyRepository.findById(policyId).orElse(null);
        } else {
            policy = mfaPolicyRepository.findByTenantIdAndIsDefaultTrueAndStatus(tenantId, PolicyStatus.ACTIVE)
                    .orElse(null);
        }

        if (policy == null) return null;

        MfaPolicyResponse response = toMfaPolicyResponse(policy);
        writeToCache(cacheKey, response);
        return response;
    }

    public AuthPolicyResult resolveAuthPolicy(UUID accountId, List<UUID> groupIds, List<UUID> roleIds,
                                               Map<String, Object> context) {
        UUID tenantId = TenantContext.requireTenantId();

        // Get all auth policy bindings for this account
        List<PolicyBinding> bindings = bindingRepository.findBindingsForAccount(
                PolicyType.AUTH, tenantId, accountId,
                groupIds != null ? groupIds : List.of(),
                roleIds != null ? roleIds : List.of());

        Set<UUID> boundPolicyIds = new HashSet<>();
        for (PolicyBinding b : bindings) {
            boundPolicyIds.add(b.getPolicyId());
        }

        // Get all active auth policies for this tenant, ordered by priority
        List<AuthPolicy> policies = authPolicyRepository
                .findByTenantIdAndStatusOrderByPriorityAsc(tenantId, PolicyStatus.ACTIVE);

        // Build SpEL evaluation context
        EvaluationContext evalContext = buildEvaluationContext(accountId, tenantId, context);

        // Evaluate policies in priority order — first match wins
        for (AuthPolicy policy : policies) {
            // Policy must be bound to this account (or be a default)
            if (!policy.isDefault() && !boundPolicyIds.contains(policy.getAuthPolicyId())) {
                continue;
            }

            try {
                Boolean result = spelParser.parseExpression(policy.getRuleExpression())
                        .getValue(evalContext, Boolean.class);
                if (Boolean.TRUE.equals(result)) {
                    return new AuthPolicyResult(
                            policy.getAction().name(),
                            policy.isMfaRequired(),
                            policy.getRequiredAuthLevel(),
                            policy.getAuthPolicyId(),
                            policy.getPolicyName(),
                            policy.getRuleExpression()
                    );
                }
            } catch (Exception e) {
                // Skip policies with evaluation errors
            }
        }

        // Default: allow
        return new AuthPolicyResult("ALLOW", false, 1, null, null, null);
    }

    // ---- Binding hierarchy resolution ----

    private UUID resolveByPriority(List<PolicyBinding> bindings) {
        if (bindings == null || bindings.isEmpty()) return null;

        // Sort by target type priority (most specific first)
        // Defensive copy to avoid UnsupportedOperationException on immutable lists
        List<PolicyBinding> sorted = new ArrayList<>(bindings);
        sorted.sort(Comparator.comparingInt(b -> {
            int idx = PRIORITY_ORDER.indexOf(b.getTargetType());
            return idx >= 0 ? idx : Integer.MAX_VALUE;
        }));

        return sorted.get(0).getPolicyId();
    }

    private EvaluationContext buildEvaluationContext(UUID accountId, UUID tenantId, Map<String, Object> context) {
        StandardEvaluationContext evalContext = new StandardEvaluationContext();
        evalContext.setVariable("accountId", accountId.toString());
        evalContext.setVariable("tenantId", tenantId.toString());
        if (context != null) {
            context.forEach(evalContext::setVariable);
        }
        return evalContext;
    }

    // ---- Cache helpers ----

    private <T> T readFromCache(String key, Class<T> type) {
        try {
            String json = redisTemplate.opsForValue().get(key);
            if (json != null) {
                return objectMapper.readValue(json, type);
            }
        } catch (JsonProcessingException e) {
            // Cache miss
        }
        return null;
    }

    private void writeToCache(String key, Object value) {
        try {
            String json = objectMapper.writeValueAsString(value);
            redisTemplate.opsForValue().set(key, json, Duration.ofSeconds(CACHE_TTL_SECONDS));
        } catch (JsonProcessingException e) {
            // Don't fail on cache write error
        }
    }

    // ---- Mapping helpers ----

    PasswordPolicyResponse toPasswordPolicyResponse(PasswordPolicy p) {
        return new PasswordPolicyResponse(
                p.getPasswordPolicyId(), p.getPolicyName(),
                p.getMinLength(), p.getMaxLength(),
                p.isRequireUppercase(), p.isRequireLowercase(),
                p.isRequireDigit(), p.isRequireSpecial(),
                p.getMaxRepeatedChars(), p.getHistoryCount(),
                p.getMaxAgeDays(), p.getMinAgeDays(),
                p.getLockoutThreshold(), p.getLockoutDurationMin(),
                p.isDefault(), p.getStatus().name()
        );
    }

    MfaPolicyResponse toMfaPolicyResponse(MfaPolicy p) {
        List<String> methods = List.of();
        if (p.getAllowedMethods() != null) {
            try {
                methods = objectMapper.readValue(p.getAllowedMethods(), new TypeReference<>() {});
            } catch (JsonProcessingException e) {
                // Return empty methods
            }
        }
        return new MfaPolicyResponse(
                p.getMfaPolicyId(), p.getPolicyName(),
                p.getEnforcementMode().name(), methods,
                p.getRememberDeviceDays(), p.getGracePeriodDays(),
                p.isDefault(), p.getStatus().name()
        );
    }
}
