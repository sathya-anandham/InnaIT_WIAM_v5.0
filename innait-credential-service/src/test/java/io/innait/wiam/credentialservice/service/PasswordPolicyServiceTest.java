package io.innait.wiam.credentialservice.service;

import io.innait.wiam.common.context.TenantContext;
import io.innait.wiam.credentialservice.entity.PasswordPolicy;
import io.innait.wiam.credentialservice.repository.PasswordPolicyRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class PasswordPolicyServiceTest {

    @Mock
    private PasswordPolicyRepository policyRepository;

    @InjectMocks
    private PasswordPolicyService service;

    private final UUID tenantId = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        TenantContext.setTenantId(tenantId);
    }

    @AfterEach
    void tearDown() {
        TenantContext.clear();
    }

    // ---- Policy retrieval ----

    @Test
    void shouldReturnTenantDefaultPolicy() {
        PasswordPolicy tenantPolicy = new PasswordPolicy();
        tenantPolicy.setPolicyName("STRICT");
        tenantPolicy.setMinLength(12);
        tenantPolicy.setDefault(true);
        when(policyRepository.findByTenantIdAndIsDefaultTrue(tenantId))
                .thenReturn(Optional.of(tenantPolicy));

        PasswordPolicy result = service.getEffectivePolicy();

        assertThat(result.getPolicyName()).isEqualTo("STRICT");
        assertThat(result.getMinLength()).isEqualTo(12);
    }

    @Test
    void shouldFallbackToDefaultPolicyWhenNoneConfigured() {
        when(policyRepository.findByTenantIdAndIsDefaultTrue(tenantId)).thenReturn(Optional.empty());

        PasswordPolicy result = service.getEffectivePolicy();

        assertThat(result.getPolicyName()).isEqualTo("DEFAULT");
        assertThat(result.getMinLength()).isEqualTo(8);
        assertThat(result.getMaxLength()).isEqualTo(128);
        assertThat(result.getHistoryCount()).isEqualTo(5);
    }

    // ---- Validation ----

    @Test
    void shouldAcceptStrongPassword() {
        PasswordPolicy policy = fullPolicy();
        List<String> violations = service.validate("Str0ngP@ss!", policy);
        assertThat(violations).isEmpty();
    }

    @Test
    void shouldRejectEmptyPassword() {
        PasswordPolicy policy = fullPolicy();
        List<String> violations = service.validate("", policy);
        assertThat(violations).contains("Password must not be empty");
    }

    @Test
    void shouldRejectNullPassword() {
        PasswordPolicy policy = fullPolicy();
        List<String> violations = service.validate(null, policy);
        assertThat(violations).contains("Password must not be empty");
    }

    @Test
    void shouldRejectTooShort() {
        PasswordPolicy policy = fullPolicy();
        policy.setMinLength(10);
        List<String> violations = service.validate("Sh0rt@", policy);
        assertThat(violations).anyMatch(v -> v.contains("at least 10 characters"));
    }

    @Test
    void shouldRejectTooLong() {
        PasswordPolicy policy = fullPolicy();
        policy.setMaxLength(20);
        String longPassword = "A1@" + "a".repeat(20);
        List<String> violations = service.validate(longPassword, policy);
        assertThat(violations).anyMatch(v -> v.contains("must not exceed 20"));
    }

    @Test
    void shouldRejectMissingUppercase() {
        PasswordPolicy policy = fullPolicy();
        List<String> violations = service.validate("lowercase1@", policy);
        assertThat(violations).anyMatch(v -> v.contains("uppercase"));
    }

    @Test
    void shouldRejectMissingLowercase() {
        PasswordPolicy policy = fullPolicy();
        List<String> violations = service.validate("UPPERCASE1@", policy);
        assertThat(violations).anyMatch(v -> v.contains("lowercase"));
    }

    @Test
    void shouldRejectMissingDigit() {
        PasswordPolicy policy = fullPolicy();
        List<String> violations = service.validate("NoDigits@Here", policy);
        assertThat(violations).anyMatch(v -> v.contains("digit"));
    }

    @Test
    void shouldRejectMissingSpecialChar() {
        PasswordPolicy policy = fullPolicy();
        List<String> violations = service.validate("NoSpecial1Here", policy);
        assertThat(violations).anyMatch(v -> v.contains("special character"));
    }

    @Test
    void shouldAllowWhenPolicyRelaxed() {
        PasswordPolicy policy = fullPolicy();
        policy.setRequireUppercase(false);
        policy.setRequireLowercase(false);
        policy.setRequireDigit(false);
        policy.setRequireSpecial(false);
        policy.setMinLength(4);

        List<String> violations = service.validate("simple", policy);
        assertThat(violations).isEmpty();
    }

    @Test
    void shouldCollectMultipleViolations() {
        PasswordPolicy policy = fullPolicy();
        policy.setMinLength(20);
        List<String> violations = service.validate("short", policy);
        // Too short + missing uppercase + missing digit + missing special
        assertThat(violations).hasSizeGreaterThanOrEqualTo(3);
    }

    // ---- Helpers ----

    private PasswordPolicy fullPolicy() {
        PasswordPolicy policy = new PasswordPolicy();
        policy.setMinLength(8);
        policy.setMaxLength(128);
        policy.setRequireUppercase(true);
        policy.setRequireLowercase(true);
        policy.setRequireDigit(true);
        policy.setRequireSpecial(true);
        policy.setHistoryCount(5);
        return policy;
    }
}
