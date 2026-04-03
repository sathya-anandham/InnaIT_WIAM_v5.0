package io.innait.wiam.adminbff.config;

import io.innait.wiam.common.security.JwtAuthenticationFilter;
import io.innait.wiam.common.security.TenantSecurityFilter;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.HttpStatusEntryPoint;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.security.web.csrf.CookieCsrfTokenRepository;
import org.springframework.security.web.csrf.CsrfTokenRequestAttributeHandler;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.List;

@Configuration
@EnableWebSecurity
@EnableMethodSecurity
public class BffSecurityConfig {

    private final JwtAuthenticationFilter jwtAuthenticationFilter;
    private final TenantSecurityFilter tenantSecurityFilter;

    @Value("${innait.security.cors.allowed-origins:http://localhost:4200}")
    private String allowedOrigins;

    public BffSecurityConfig(JwtAuthenticationFilter jwtAuthenticationFilter,
                             TenantSecurityFilter tenantSecurityFilter) {
        this.jwtAuthenticationFilter = jwtAuthenticationFilter;
        this.tenantSecurityFilter = tenantSecurityFilter;
    }

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        // CSRF with double-submit cookie for Angular HttpXsrfInterceptor
        CsrfTokenRequestAttributeHandler csrfHandler = new CsrfTokenRequestAttributeHandler();
        csrfHandler.setCsrfRequestAttributeName("_csrf");

        http
                .csrf(csrf -> csrf
                        .csrfTokenRepository(CookieCsrfTokenRepository.withHttpOnlyFalse())
                        .csrfTokenRequestHandler(csrfHandler)
                        .ignoringRequestMatchers(
                                "/actuator/**",
                                "/ws/**",
                                "/api/v1/self/credentials/password/forgot",
                                "/api/v1/self/credentials/password/verify-otp",
                                "/api/v1/self/credentials/password/reset",
                                "/api/v1/self/recovery"
                        )
                )
                .cors(cors -> cors.configurationSource(corsConfigurationSource()))
                .sessionManagement(session -> session
                        .sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers(
                                "/actuator/health",
                                "/actuator/info",
                                "/actuator/prometheus",
                                "/v3/api-docs/**",
                                "/swagger-ui/**",
                                "/swagger-ui.html",
                                "/ws/**",
                                "/api/v1/self/credentials/password/forgot",
                                "/api/v1/self/credentials/password/verify-otp",
                                "/api/v1/self/credentials/password/reset",
                                "/api/v1/self/recovery"
                        ).permitAll()
                        .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()
                        .anyRequest().authenticated()
                )
                .exceptionHandling(ex -> ex
                        .authenticationEntryPoint(new HttpStatusEntryPoint(HttpStatus.UNAUTHORIZED))
                )
                .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class)
                .addFilterAfter(tenantSecurityFilter, JwtAuthenticationFilter.class);

        return http.build();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration config = new CorsConfiguration();
        config.setAllowedOrigins(List.of(allowedOrigins.split(",")));
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        config.setAllowedHeaders(List.of(
                "Authorization", "Content-Type", "X-Tenant-ID",
                "X-Correlation-ID", "X-XSRF-TOKEN", "X-Requested-With", "Accept"
        ));
        config.setExposedHeaders(List.of("X-Correlation-ID", "X-XSRF-TOKEN"));
        config.setAllowCredentials(true);
        config.setMaxAge(3600L);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return source;
    }
}
