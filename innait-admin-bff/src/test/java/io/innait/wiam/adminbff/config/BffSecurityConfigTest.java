package io.innait.wiam.adminbff.config;

import io.innait.wiam.common.kafka.EventPublisher;
import io.innait.wiam.common.security.JwtAuthenticationFilter;
import io.innait.wiam.common.security.TenantSecurityFilter;
import jakarta.persistence.EntityManager;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletRequest;
import jakarta.servlet.ServletResponse;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import org.springframework.data.redis.connection.RedisConnection;

import org.mockito.Answers;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class BffSecurityConfigTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private JwtAuthenticationFilter jwtAuthenticationFilter;

    @MockBean
    private TenantSecurityFilter tenantSecurityFilter;

    @MockBean
    private EntityManager entityManager;

    @MockBean
    private EventPublisher eventPublisher;

    @MockBean
    private RedisConnectionFactory redisConnectionFactory;

    @MockBean
    private StringRedisTemplate stringRedisTemplate;

    @BeforeEach
    void setUp() throws Exception {
        // Both filters pass requests through without modifying security context
        doAnswer(inv -> {
            FilterChain chain = inv.getArgument(2);
            chain.doFilter(inv.getArgument(0), inv.getArgument(1));
            return null;
        }).when(jwtAuthenticationFilter).doFilter(any(ServletRequest.class), any(ServletResponse.class), any(FilterChain.class));
        doAnswer(inv -> {
            FilterChain chain = inv.getArgument(2);
            chain.doFilter(inv.getArgument(0), inv.getArgument(1));
            return null;
        }).when(tenantSecurityFilter).doFilter(any(ServletRequest.class), any(ServletResponse.class), any(FilterChain.class));
        // Allow Redis session store and health indicator to work without NPE
        RedisConnection mockConn = mock(RedisConnection.class, Answers.RETURNS_DEEP_STUBS);
        when(mockConn.ping()).thenReturn("PONG");
        when(mockConn.keyCommands().exists(any(byte[].class))).thenReturn(true); // hasKey() → true, prevents "Session was invalidated"
        when(redisConnectionFactory.getConnection()).thenReturn(mockConn);
    }

    @Nested
    class CsrfProtection {

        @Test
        void shouldReturn403WhenCsrfTokenMissing() throws Exception {
            mockMvc.perform(post("/api/v1/self/credentials/password/change")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"currentPassword\":\"old\",\"newPassword\":\"new\"}"))
                    .andExpect(status().isForbidden());
        }

        @Test
        void shouldAcceptRequestWithValidCsrfToken() throws Exception {
            // With csrf() processor, Spring Security test adds valid CSRF token
            mockMvc.perform(post("/api/v1/self/credentials/password/change")
                            .with(csrf())
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"currentPassword\":\"old\",\"newPassword\":\"new\"}"))
                    .andExpect(status().isUnauthorized()); // 401 because no JWT, not 403
        }
    }

    @Nested
    class PublicEndpoints {

        @Test
        void shouldAllowHealthEndpoint() throws Exception {
            mockMvc.perform(get("/actuator/health"))
                    .andExpect(status().isOk());
        }

        @Test
        void shouldAllowSwaggerUi() throws Exception {
            // Swagger redirect or serve — just not 401/403
            mockMvc.perform(get("/swagger-ui/index.html"))
                    .andExpect(status().is(org.hamcrest.Matchers.not(
                            org.hamcrest.Matchers.anyOf(
                                    org.hamcrest.Matchers.is(401),
                                    org.hamcrest.Matchers.is(403)))));
        }

        @Test
        void shouldRequireAuthForProtectedEndpoints() throws Exception {
            mockMvc.perform(get("/api/v1/self/profile"))
                    .andExpect(status().isUnauthorized());
        }
    }
}
