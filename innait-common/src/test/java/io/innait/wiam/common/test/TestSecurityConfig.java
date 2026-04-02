package io.innait.wiam.common.test;

import io.innait.wiam.common.security.InnaITAuthenticationToken;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.SecurityFilterChain;

import java.util.List;
import java.util.UUID;

/**
 * Reusable test security configuration that disables all security filters
 * and provides helper methods to set up mock authentication for @WebMvcTest.
 */
@TestConfiguration
public class TestSecurityConfig {

    @Bean
    public SecurityFilterChain testSecurityFilterChain(HttpSecurity http) throws Exception {
        http
                .csrf(AbstractHttpConfigurer::disable)
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth.anyRequest().permitAll());
        return http.build();
    }

    /**
     * Set up authentication context with the given roles.
     */
    public static InnaITAuthenticationToken authenticate(UUID tenantId, UUID userId, UUID sessionId,
                                                          String subject, List<String> roles) {
        List<SimpleGrantedAuthority> authorities = roles.stream()
                .map(r -> new SimpleGrantedAuthority("ROLE_" + r))
                .toList();

        InnaITAuthenticationToken token = new InnaITAuthenticationToken(
                subject, tenantId, userId, "testuser", sessionId,
                roles, List.of(), List.of("pwd"), "aal2",
                "mock-raw-token", authorities
        );

        SecurityContext context = SecurityContextHolder.createEmptyContext();
        context.setAuthentication(token);
        SecurityContextHolder.setContext(context);

        return token;
    }

    /**
     * Set up a default SUPER_ADMIN authentication context.
     */
    public static InnaITAuthenticationToken authenticateAsAdmin() {
        return authenticate(
                UUID.randomUUID(), UUID.randomUUID(), UUID.randomUUID(),
                "admin@innait.io", List.of("SUPER_ADMIN")
        );
    }

    /**
     * Clear the authentication context.
     */
    public static void clearAuthentication() {
        SecurityContextHolder.clearContext();
    }
}
