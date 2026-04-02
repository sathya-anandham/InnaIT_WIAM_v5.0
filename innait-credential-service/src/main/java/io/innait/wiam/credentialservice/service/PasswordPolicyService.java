package io.innait.wiam.credentialservice.service;

import io.innait.wiam.common.context.TenantContext;
import io.innait.wiam.credentialservice.entity.PasswordPolicy;
import io.innait.wiam.credentialservice.repository.PasswordPolicyRepository;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Service
public class PasswordPolicyService {

    private final PasswordPolicyRepository policyRepository;

    public PasswordPolicyService(PasswordPolicyRepository policyRepository) {
        this.policyRepository = policyRepository;
    }

    public PasswordPolicy getEffectivePolicy() {
        UUID tenantId = TenantContext.requireTenantId();
        return policyRepository.findByTenantIdAndIsDefaultTrue(tenantId)
                .orElseGet(this::defaultPolicy);
    }

    public List<String> validate(String password, PasswordPolicy policy) {
        List<String> violations = new ArrayList<>();

        if (password == null || password.isEmpty()) {
            violations.add("Password must not be empty");
            return violations;
        }

        if (password.length() < policy.getMinLength()) {
            violations.add("Password must be at least " + policy.getMinLength() + " characters");
        }
        if (password.length() > policy.getMaxLength()) {
            violations.add("Password must not exceed " + policy.getMaxLength() + " characters");
        }
        if (policy.isRequireUppercase() && !password.chars().anyMatch(Character::isUpperCase)) {
            violations.add("Password must contain at least one uppercase letter");
        }
        if (policy.isRequireLowercase() && !password.chars().anyMatch(Character::isLowerCase)) {
            violations.add("Password must contain at least one lowercase letter");
        }
        if (policy.isRequireDigit() && !password.chars().anyMatch(Character::isDigit)) {
            violations.add("Password must contain at least one digit");
        }
        if (policy.isRequireSpecial() && password.chars().allMatch(c -> Character.isLetterOrDigit(c))) {
            violations.add("Password must contain at least one special character");
        }

        return violations;
    }

    PasswordPolicy defaultPolicy() {
        PasswordPolicy policy = new PasswordPolicy();
        policy.setPolicyName("DEFAULT");
        policy.setMinLength(8);
        policy.setMaxLength(128);
        policy.setRequireUppercase(true);
        policy.setRequireLowercase(true);
        policy.setRequireDigit(true);
        policy.setRequireSpecial(true);
        policy.setHistoryCount(5);
        policy.setMaxAgeDays(90);
        policy.setLockoutThreshold(5);
        policy.setLockoutDurationMin(30);
        return policy;
    }
}
