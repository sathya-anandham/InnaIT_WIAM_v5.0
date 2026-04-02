package io.innait.wiam.common.security;

import org.junit.jupiter.api.Test;
import org.springframework.security.core.authority.SimpleGrantedAuthority;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class InnaITAuthenticationTokenTest {

    private final UUID tenantId = UUID.randomUUID();
    private final UUID userId = UUID.randomUUID();
    private final UUID sessionId = UUID.randomUUID();

    @Test
    void shouldCreateTokenWithAllFields() {
        var token = buildToken(List.of("ADMIN", "USER"), List.of("engineering"), List.of("pwd"), "aal1");

        assertThat(token.getSubject()).isEqualTo("admin@innait.io");
        assertThat(token.getPrincipal()).isEqualTo("admin@innait.io");
        assertThat(token.getTenantId()).isEqualTo(tenantId);
        assertThat(token.getUserId()).isEqualTo(userId);
        assertThat(token.getLoginId()).isEqualTo("admin");
        assertThat(token.getSessionId()).isEqualTo(sessionId);
        assertThat(token.getRoles()).containsExactly("ADMIN", "USER");
        assertThat(token.getGroups()).containsExactly("engineering");
        assertThat(token.getAmr()).containsExactly("pwd");
        assertThat(token.getAcr()).isEqualTo("aal1");
        assertThat(token.getCredentials()).isEqualTo("raw-jwt-token");
        assertThat(token.isAuthenticated()).isTrue();
    }

    @Test
    void shouldMapRolesToGrantedAuthorities() {
        var token = buildToken(List.of("ADMIN", "AUDITOR"), List.of(), List.of(), null);

        assertThat(token.getAuthorities())
                .extracting("authority")
                .containsExactly("ROLE_ADMIN", "ROLE_AUDITOR");
    }

    @Test
    void shouldReturnImmutableLists() {
        var token = buildToken(List.of("ADMIN"), List.of("grp"), List.of("pwd"), null);

        org.junit.jupiter.api.Assertions.assertThrows(UnsupportedOperationException.class,
                () -> token.getRoles().add("HACKER"));
        org.junit.jupiter.api.Assertions.assertThrows(UnsupportedOperationException.class,
                () -> token.getGroups().add("evil"));
        org.junit.jupiter.api.Assertions.assertThrows(UnsupportedOperationException.class,
                () -> token.getAmr().add("evil"));
    }

    @Test
    void shouldHandleNullLists() {
        var token = new InnaITAuthenticationToken(
                "sub", tenantId, userId, "login", sessionId,
                null, null, null, null, "token", List.of()
        );

        assertThat(token.getRoles()).isEmpty();
        assertThat(token.getGroups()).isEmpty();
        assertThat(token.getAmr()).isEmpty();
    }

    private InnaITAuthenticationToken buildToken(List<String> roles, List<String> groups,
                                                  List<String> amr, String acr) {
        var authorities = roles.stream()
                .map(r -> new SimpleGrantedAuthority("ROLE_" + r))
                .toList();
        return new InnaITAuthenticationToken(
                "admin@innait.io", tenantId, userId, "admin", sessionId,
                roles, groups, amr, acr, "raw-jwt-token", authorities
        );
    }
}
