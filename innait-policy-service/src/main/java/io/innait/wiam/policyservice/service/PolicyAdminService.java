package io.innait.wiam.policyservice.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.innait.wiam.common.context.TenantContext;
import io.innait.wiam.common.event.EventEnvelope;
import io.innait.wiam.common.exception.ResourceNotFoundException;
import io.innait.wiam.common.kafka.EventPublisher;
import io.innait.wiam.common.kafka.InnaITTopics;
import io.innait.wiam.policyservice.dto.*;
import io.innait.wiam.policyservice.entity.*;
import io.innait.wiam.policyservice.repository.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class PolicyAdminService {

    private final PasswordPolicyRepository passwordPolicyRepository;
    private final MfaPolicyRepository mfaPolicyRepository;
    private final AuthPolicyRepository authPolicyRepository;
    private final PolicyBindingRepository bindingRepository;
    private final EventPublisher eventPublisher;
    private final ObjectMapper objectMapper;
    private final PolicyService policyService;

    public PolicyAdminService(PasswordPolicyRepository passwordPolicyRepository,
                              MfaPolicyRepository mfaPolicyRepository,
                              AuthPolicyRepository authPolicyRepository,
                              PolicyBindingRepository bindingRepository,
                              EventPublisher eventPublisher,
                              ObjectMapper objectMapper,
                              PolicyService policyService) {
        this.passwordPolicyRepository = passwordPolicyRepository;
        this.mfaPolicyRepository = mfaPolicyRepository;
        this.authPolicyRepository = authPolicyRepository;
        this.bindingRepository = bindingRepository;
        this.eventPublisher = eventPublisher;
        this.objectMapper = objectMapper;
        this.policyService = policyService;
    }

    // ---- Password Policy CRUD ----

    @Transactional
    public PasswordPolicyResponse createPasswordPolicy(PasswordPolicyCreateRequest request) {
        UUID tenantId = TenantContext.requireTenantId();

        PasswordPolicy policy = new PasswordPolicy();
        policy.setTenantId(tenantId);
        policy.setPolicyName(request.policyName());
        policy.setMinLength(request.minLength());
        policy.setMaxLength(request.maxLength());
        policy.setRequireUppercase(request.requireUppercase());
        policy.setRequireLowercase(request.requireLowercase());
        policy.setRequireDigit(request.requireDigit());
        policy.setRequireSpecial(request.requireSpecial());
        policy.setMaxRepeatedChars(request.maxRepeatedChars());
        policy.setHistoryCount(request.historyCount());
        policy.setMaxAgeDays(request.maxAgeDays());
        policy.setMinAgeDays(request.minAgeDays());
        policy.setLockoutThreshold(request.lockoutThreshold());
        policy.setLockoutDurationMin(request.lockoutDurationMin());
        policy.setDefault(request.isDefault());
        policy.setStatus(PolicyStatus.ACTIVE);
        passwordPolicyRepository.save(policy);

        publishPolicyEvent("password.policy.created", tenantId, policy.getPasswordPolicyId());
        return policyService.toPasswordPolicyResponse(policy);
    }

    @Transactional
    public PasswordPolicyResponse updatePasswordPolicy(UUID policyId, PasswordPolicyCreateRequest request) {
        PasswordPolicy policy = passwordPolicyRepository.findById(policyId)
                .orElseThrow(() -> new ResourceNotFoundException("PasswordPolicy", policyId.toString()));

        policy.setPolicyName(request.policyName());
        policy.setMinLength(request.minLength());
        policy.setMaxLength(request.maxLength());
        policy.setRequireUppercase(request.requireUppercase());
        policy.setRequireLowercase(request.requireLowercase());
        policy.setRequireDigit(request.requireDigit());
        policy.setRequireSpecial(request.requireSpecial());
        policy.setMaxRepeatedChars(request.maxRepeatedChars());
        policy.setHistoryCount(request.historyCount());
        policy.setMaxAgeDays(request.maxAgeDays());
        policy.setMinAgeDays(request.minAgeDays());
        policy.setLockoutThreshold(request.lockoutThreshold());
        policy.setLockoutDurationMin(request.lockoutDurationMin());
        policy.setDefault(request.isDefault());
        passwordPolicyRepository.save(policy);

        publishPolicyEvent("password.policy.updated", policy.getTenantId(), policyId);
        return policyService.toPasswordPolicyResponse(policy);
    }

    public PasswordPolicyResponse getPasswordPolicy(UUID policyId) {
        PasswordPolicy policy = passwordPolicyRepository.findById(policyId)
                .orElseThrow(() -> new ResourceNotFoundException("PasswordPolicy", policyId.toString()));
        return policyService.toPasswordPolicyResponse(policy);
    }

    public List<PasswordPolicyResponse> listPasswordPolicies() {
        UUID tenantId = TenantContext.requireTenantId();
        return passwordPolicyRepository.findByTenantIdAndStatus(tenantId, PolicyStatus.ACTIVE)
                .stream().map(policyService::toPasswordPolicyResponse).toList();
    }

    @Transactional
    public void deletePasswordPolicy(UUID policyId) {
        PasswordPolicy policy = passwordPolicyRepository.findById(policyId)
                .orElseThrow(() -> new ResourceNotFoundException("PasswordPolicy", policyId.toString()));
        policy.setStatus(PolicyStatus.INACTIVE);
        passwordPolicyRepository.save(policy);
        publishPolicyEvent("password.policy.deleted", policy.getTenantId(), policyId);
    }

    // ---- MFA Policy CRUD ----

    @Transactional
    public MfaPolicyResponse createMfaPolicy(MfaPolicyCreateRequest request) {
        UUID tenantId = TenantContext.requireTenantId();

        MfaPolicy policy = new MfaPolicy();
        policy.setTenantId(tenantId);
        policy.setPolicyName(request.policyName());
        policy.setEnforcementMode(EnforcementMode.valueOf(request.enforcementMode()));
        policy.setAllowedMethods(toJson(request.allowedMethods()));
        policy.setRememberDeviceDays(request.rememberDeviceDays());
        policy.setGracePeriodDays(request.gracePeriodDays());
        policy.setDefault(request.isDefault());
        policy.setStatus(PolicyStatus.ACTIVE);
        mfaPolicyRepository.save(policy);

        publishPolicyEvent("mfa.policy.created", tenantId, policy.getMfaPolicyId());
        return policyService.toMfaPolicyResponse(policy);
    }

    @Transactional
    public MfaPolicyResponse updateMfaPolicy(UUID policyId, MfaPolicyCreateRequest request) {
        MfaPolicy policy = mfaPolicyRepository.findById(policyId)
                .orElseThrow(() -> new ResourceNotFoundException("MfaPolicy", policyId.toString()));

        policy.setPolicyName(request.policyName());
        policy.setEnforcementMode(EnforcementMode.valueOf(request.enforcementMode()));
        policy.setAllowedMethods(toJson(request.allowedMethods()));
        policy.setRememberDeviceDays(request.rememberDeviceDays());
        policy.setGracePeriodDays(request.gracePeriodDays());
        policy.setDefault(request.isDefault());
        mfaPolicyRepository.save(policy);

        publishPolicyEvent("mfa.policy.updated", policy.getTenantId(), policyId);
        return policyService.toMfaPolicyResponse(policy);
    }

    public MfaPolicyResponse getMfaPolicy(UUID policyId) {
        MfaPolicy policy = mfaPolicyRepository.findById(policyId)
                .orElseThrow(() -> new ResourceNotFoundException("MfaPolicy", policyId.toString()));
        return policyService.toMfaPolicyResponse(policy);
    }

    public List<MfaPolicyResponse> listMfaPolicies() {
        UUID tenantId = TenantContext.requireTenantId();
        return mfaPolicyRepository.findByTenantIdAndStatus(tenantId, PolicyStatus.ACTIVE)
                .stream().map(policyService::toMfaPolicyResponse).toList();
    }

    @Transactional
    public void deleteMfaPolicy(UUID policyId) {
        MfaPolicy policy = mfaPolicyRepository.findById(policyId)
                .orElseThrow(() -> new ResourceNotFoundException("MfaPolicy", policyId.toString()));
        policy.setStatus(PolicyStatus.INACTIVE);
        mfaPolicyRepository.save(policy);
        publishPolicyEvent("mfa.policy.deleted", policy.getTenantId(), policyId);
    }

    // ---- Auth Policy CRUD ----

    @Transactional
    public AuthPolicyResponse createAuthPolicy(AuthPolicyCreateRequest request) {
        UUID tenantId = TenantContext.requireTenantId();

        AuthPolicy policy = new AuthPolicy();
        policy.setTenantId(tenantId);
        policy.setPolicyName(request.policyName());
        policy.setDescription(request.description());
        policy.setPriority(request.priority());
        policy.setRuleExpression(request.ruleExpression());
        policy.setAction(PolicyAction.valueOf(request.action()));
        policy.setMfaRequired(request.mfaRequired());
        policy.setRequiredAuthLevel(request.requiredAuthLevel());
        policy.setDefault(request.isDefault());
        policy.setStatus(PolicyStatus.ACTIVE);
        authPolicyRepository.save(policy);

        publishPolicyEvent("auth.policy.created", tenantId, policy.getAuthPolicyId());
        return toAuthPolicyResponse(policy);
    }

    @Transactional
    public AuthPolicyResponse updateAuthPolicy(UUID policyId, AuthPolicyCreateRequest request) {
        AuthPolicy policy = authPolicyRepository.findById(policyId)
                .orElseThrow(() -> new ResourceNotFoundException("AuthPolicy", policyId.toString()));

        policy.setPolicyName(request.policyName());
        policy.setDescription(request.description());
        policy.setPriority(request.priority());
        policy.setRuleExpression(request.ruleExpression());
        policy.setAction(PolicyAction.valueOf(request.action()));
        policy.setMfaRequired(request.mfaRequired());
        policy.setRequiredAuthLevel(request.requiredAuthLevel());
        policy.setDefault(request.isDefault());
        authPolicyRepository.save(policy);

        publishPolicyEvent("auth.policy.updated", policy.getTenantId(), policyId);
        return toAuthPolicyResponse(policy);
    }

    public AuthPolicyResponse getAuthPolicy(UUID policyId) {
        AuthPolicy policy = authPolicyRepository.findById(policyId)
                .orElseThrow(() -> new ResourceNotFoundException("AuthPolicy", policyId.toString()));
        return toAuthPolicyResponse(policy);
    }

    public List<AuthPolicyResponse> listAuthPolicies() {
        UUID tenantId = TenantContext.requireTenantId();
        return authPolicyRepository.findByTenantIdAndStatusOrderByPriorityAsc(tenantId, PolicyStatus.ACTIVE)
                .stream().map(this::toAuthPolicyResponse).toList();
    }

    @Transactional
    public void deleteAuthPolicy(UUID policyId) {
        AuthPolicy policy = authPolicyRepository.findById(policyId)
                .orElseThrow(() -> new ResourceNotFoundException("AuthPolicy", policyId.toString()));
        policy.setStatus(PolicyStatus.INACTIVE);
        authPolicyRepository.save(policy);
        publishPolicyEvent("auth.policy.deleted", policy.getTenantId(), policyId);
    }

    // ---- Policy Bindings ----

    @Transactional
    public PolicyBindingResponse createBinding(PolicyBindingRequest request) {
        UUID tenantId = TenantContext.requireTenantId();

        PolicyBinding binding = new PolicyBinding();
        binding.setTenantId(tenantId);
        binding.setPolicyType(PolicyType.valueOf(request.policyType()));
        binding.setPolicyId(request.policyId());
        binding.setTargetType(TargetType.valueOf(request.targetType()));
        binding.setTargetId(request.targetId());
        binding.setActive(true);
        bindingRepository.save(binding);

        return toBindingResponse(binding);
    }

    @Transactional
    public void deleteBinding(UUID bindingId) {
        PolicyBinding binding = bindingRepository.findById(bindingId)
                .orElseThrow(() -> new ResourceNotFoundException("PolicyBinding", bindingId.toString()));
        binding.setActive(false);
        bindingRepository.save(binding);
    }

    public List<PolicyBindingResponse> listBindings() {
        UUID tenantId = TenantContext.requireTenantId();
        return bindingRepository.findByTenantIdAndActiveTrue(tenantId)
                .stream().map(this::toBindingResponse).toList();
    }

    // ---- Simulate ----

    public PolicySimulateResponse simulate(PolicySimulateRequest request) {
        PasswordPolicyResponse pwdPolicy = policyService.resolvePasswordPolicy(
                request.accountId(), request.groupIds(), request.roleIds());
        MfaPolicyResponse mfaPolicy = policyService.resolveMfaPolicy(
                request.accountId(), request.groupIds(), request.roleIds());
        AuthPolicyResult authResult = policyService.resolveAuthPolicy(
                request.accountId(), request.groupIds(), request.roleIds(), request.context());
        return new PolicySimulateResponse(pwdPolicy, mfaPolicy, authResult);
    }

    // ---- Helpers ----

    private AuthPolicyResponse toAuthPolicyResponse(AuthPolicy p) {
        return new AuthPolicyResponse(
                p.getAuthPolicyId(), p.getPolicyName(), p.getDescription(),
                p.getPriority(), p.getRuleExpression(), p.getAction().name(),
                p.isMfaRequired(), p.getRequiredAuthLevel(),
                p.isDefault(), p.getStatus().name()
        );
    }

    private PolicyBindingResponse toBindingResponse(PolicyBinding b) {
        return new PolicyBindingResponse(
                b.getBindingId(), b.getPolicyType().name(), b.getPolicyId(),
                b.getTargetType().name(), b.getTargetId(), b.isActive()
        );
    }

    private void publishPolicyEvent(String eventType, UUID tenantId, UUID policyId) {
        eventPublisher.publish(InnaITTopics.POLICY_UPDATED,
                EventEnvelope.builder()
                        .eventType(eventType)
                        .tenantId(tenantId)
                        .payload(Map.of("policyId", policyId.toString()))
                        .build());
    }

    private String toJson(Object obj) {
        try {
            return objectMapper.writeValueAsString(obj);
        } catch (JsonProcessingException e) {
            return "[]";
        }
    }
}
