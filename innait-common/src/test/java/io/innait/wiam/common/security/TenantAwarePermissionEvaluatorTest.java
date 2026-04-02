package io.innait.wiam.common.security;

import io.innait.wiam.common.context.TenantContext;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class TenantAwarePermissionEvaluatorTest {

    private TenantAwarePermissionEvaluator evaluator;
    private final UUID tenantId = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        evaluator = new TenantAwarePermissionEvaluator();
        TenantContext.clear();
    }

    @AfterEach
    void tearDown() {
        TenantContext.clear();
    }

    @Test
    void shouldGrantPermissionWhenRoleMatches() {
        TenantContext.setTenantId(tenantId);
        var token = buildToken(tenantId, List.of("ADMIN", "USER"));

        assertThat(evaluator.hasPermission(token, null, "ADMIN")).isTrue();
    }

    @Test
    void shouldDenyPermissionWhenRoleDoesNotMatch() {
        TenantContext.setTenantId(tenantId);
        var token = buildToken(tenantId, List.of("USER"));

        assertThat(evaluator.hasPermission(token, null, "ADMIN")).isFalse();
    }

    @Test
    void shouldDenyPermissionWhenTenantMismatch() {
        UUID otherTenant = UUID.randomUUID();
        TenantContext.setTenantId(otherTenant);
        var token = buildToken(tenantId, List.of("ADMIN"));

        assertThat(evaluator.hasPermission(token, null, "ADMIN")).isFalse();
    }

    @Test
    void shouldGrantPermissionWhenNoTenantContext() {
        // TenantContext is not set (null) - should pass tenant check
        var token = buildToken(tenantId, List.of("ADMIN"));

        assertThat(evaluator.hasPermission(token, null, "ADMIN")).isTrue();
    }

    @Test
    void shouldDenyPermissionForNonInnaITToken() {
        TenantContext.setTenantId(tenantId);
        var token = new UsernamePasswordAuthenticationToken("user", "pass");

        assertThat(evaluator.hasPermission(token, null, "ADMIN")).isFalse();
    }

    @Test
    void shouldWorkWithTargetIdOverload() {
        TenantContext.setTenantId(tenantId);
        var token = buildToken(tenantId, List.of("ADMIN"));

        assertThat(evaluator.hasPermission(token, UUID.randomUUID(), "User", "ADMIN")).isTrue();
        assertThat(evaluator.hasPermission(token, UUID.randomUUID(), "User", "SUPER_ADMIN")).isFalse();
    }

    @Test
    void shouldDenyTargetIdOverloadWhenTenantMismatch() {
        UUID otherTenant = UUID.randomUUID();
        TenantContext.setTenantId(otherTenant);
        var token = buildToken(tenantId, List.of("ADMIN"));

        assertThat(evaluator.hasPermission(token, UUID.randomUUID(), "User", "ADMIN")).isFalse();
    }

    private InnaITAuthenticationToken buildToken(UUID tokenTenantId, List<String> roles) {
        var authorities = roles.stream()
                .map(r -> new SimpleGrantedAuthority("ROLE_" + r))
                .toList();
        return new InnaITAuthenticationToken(
                "user@innait.io", tokenTenantId, UUID.randomUUID(), "user", UUID.randomUUID(),
                roles, List.of(), List.of("pwd"), "aal1", "token", authorities
        );
    }
}
