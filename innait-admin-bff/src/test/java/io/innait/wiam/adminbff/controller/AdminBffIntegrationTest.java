package io.innait.wiam.adminbff.controller;

import io.innait.wiam.adminbff.client.*;
import io.innait.wiam.common.kafka.EventPublisher;
import io.innait.wiam.common.security.InnaITAuthenticationToken;
import io.innait.wiam.common.security.JwtAuthenticationFilter;
import io.innait.wiam.common.security.TenantSecurityFilter;
import jakarta.persistence.EntityManager;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletRequest;
import jakarta.servlet.ServletResponse;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.hamcrest.Matchers.*;
import org.mockito.Answers;
import org.springframework.data.redis.connection.RedisConnection;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class AdminBffIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean private JwtAuthenticationFilter jwtAuthenticationFilter;
    @MockBean private TenantSecurityFilter tenantSecurityFilter;
    @MockBean private EntityManager entityManager;
    @MockBean private EventPublisher eventPublisher;
    @MockBean private RedisConnectionFactory redisConnectionFactory;
    @MockBean private StringRedisTemplate stringRedisTemplate;
    @MockBean private IdentityServiceClient identityClient;
    @MockBean private SessionServiceClient sessionClient;
    @MockBean private AuditServiceClient auditClient;
    @MockBean private CredentialServiceClient credentialClient;
    @MockBean private AuthServiceClient authServiceClient;

    private static final UUID USER_ID = UUID.randomUUID();
    private static final UUID TENANT_ID = UUID.randomUUID();
    private static final UUID SESSION_ID = UUID.randomUUID();

    @BeforeEach
    void setUp() throws Exception {
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
        RedisConnection mockConn = mock(RedisConnection.class, Answers.RETURNS_DEEP_STUBS);
        when(mockConn.ping()).thenReturn("PONG");
        when(mockConn.keyCommands().exists(any(byte[].class))).thenReturn(true); // hasKey() → true, prevents "Session was invalidated"
        when(redisConnectionFactory.getConnection()).thenReturn(mockConn);
    }

    private InnaITAuthenticationToken adminAuth() {
        return new InnaITAuthenticationToken(
                "admin@test.com", TENANT_ID, USER_ID, "admin@test.com", SESSION_ID,
                List.of("SUPER_ADMIN"), List.of(), List.of("pwd"), "urn:innait:acr:pwd",
                "mock-jwt-token",
                List.of(new SimpleGrantedAuthority("ROLE_SUPER_ADMIN"))
        );
    }

    private InnaITAuthenticationToken userAuth() {
        return new InnaITAuthenticationToken(
                "user@test.com", TENANT_ID, USER_ID, "user@test.com", SESSION_ID,
                List.of("USER"), List.of(), List.of("pwd"), "urn:innait:acr:pwd",
                "mock-jwt-token",
                List.of(new SimpleGrantedAuthority("ROLE_USER"))
        );
    }

    @Nested
    class DashboardAggregation {

        @Test
        void shouldReturnAggregatedDashboard() throws Exception {
            when(identityClient.getUserCountsByStatus()).thenReturn(
                    Map.of("active", 100, "suspended", 2, "locked", 1, "terminated", 5, "total", 108));
            when(sessionClient.getActiveSessionCount()).thenReturn(25L);
            when(auditClient.getRecentAdminActions(10)).thenReturn(
                    List.of(Map.of("actionType", "USER_CREATED")));
            when(auditClient.getAuthStats()).thenReturn(
                    Map.of("successCount", 500L, "failureCount", 10L, "successRate", 98.04, "totalAttempts", 510L));

            mockMvc.perform(get("/api/v1/bff/dashboard")
                            .with(authentication(adminAuth())))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.status").value("SUCCESS"))
                    .andExpect(jsonPath("$.data.userCounts.active").value(100))
                    .andExpect(jsonPath("$.data.userCounts.total").value(108))
                    .andExpect(jsonPath("$.data.activeSessionCount").value(25))
                    .andExpect(jsonPath("$.data.recentAdminActions", hasSize(1)))
                    .andExpect(jsonPath("$.data.authStats.successRate").value(98.04));
        }

        @Test
        void shouldRejectDashboardForNonAdmin() throws Exception {
            mockMvc.perform(get("/api/v1/bff/dashboard")
                            .with(authentication(userAuth())))
                    .andExpect(status().isForbidden());
        }

        @Test
        void shouldReturnUserDetail() throws Exception {
            UUID targetUserId = UUID.randomUUID();
            when(identityClient.getUserProfile(targetUserId)).thenReturn(
                    Map.of("userId", targetUserId.toString(), "firstName", "John",
                            "accounts", List.of(Map.of("accountId", UUID.randomUUID().toString()))));
            when(identityClient.getUserAccounts(targetUserId)).thenReturn(List.of());
            when(identityClient.getAccountRoles(any())).thenReturn(List.of());
            when(credentialClient.getCredentialOverview(any())).thenReturn(Map.of());
            when(sessionClient.getAccountSessions(any())).thenReturn(List.of());
            when(auditClient.getUserAuditTrail(targetUserId, 50)).thenReturn(List.of());

            mockMvc.perform(get("/api/v1/bff/users/{userId}/detail", targetUserId)
                            .with(authentication(adminAuth())))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.status").value("SUCCESS"))
                    .andExpect(jsonPath("$.data.profile.firstName").value("John"));
        }
    }

    @Nested
    class SelfServiceProfile {

        @Test
        void shouldGetOwnProfile() throws Exception {
            when(identityClient.getUserProfile(USER_ID)).thenReturn(
                    Map.of("userId", USER_ID.toString(), "email", "user@test.com"));

            mockMvc.perform(get("/api/v1/self/profile")
                            .with(authentication(userAuth())))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.data.email").value("user@test.com"));
        }

        @Test
        void shouldUpdateOwnProfile() throws Exception {
            when(identityClient.updateUserProfile(any(), any())).thenReturn(
                    Map.of("firstName", "Jane", "lastName", "Updated"));

            mockMvc.perform(patch("/api/v1/self/profile")
                            .with(authentication(userAuth()))
                            .with(csrf())
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"firstName\":\"Jane\",\"lastName\":\"Updated\"}"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.data.firstName").value("Jane"));
        }
    }

    @Nested
    class SelfServicePasswordChange {

        @Test
        void shouldChangePassword() throws Exception {
            mockMvc.perform(post("/api/v1/self/credentials/password/change")
                            .with(authentication(userAuth()))
                            .with(csrf())
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"currentPassword\":\"OldPass123\",\"newPassword\":\"NewPass456!\"}"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.status").value("SUCCESS"));

            verify(credentialClient).changePassword(any());
        }
    }

    @Nested
    class SelfServiceSessionRevoke {

        @Test
        void shouldListOwnSessions() throws Exception {
            when(sessionClient.getAccountSessions(SESSION_ID)).thenReturn(
                    List.of(Map.of("sessionId", SESSION_ID.toString(), "sessionStatus", "ACTIVE")));

            mockMvc.perform(get("/api/v1/self/sessions")
                            .with(authentication(userAuth())))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.data", hasSize(1)));
        }

        @Test
        void shouldRevokeOwnSession() throws Exception {
            UUID targetSession = UUID.randomUUID();
            when(sessionClient.getAccountSessions(SESSION_ID)).thenReturn(
                    List.of(Map.of("sessionId", targetSession.toString())));

            mockMvc.perform(delete("/api/v1/self/sessions/{sessionId}", targetSession)
                            .with(authentication(userAuth()))
                            .with(csrf()))
                    .andExpect(status().isOk());

            verify(sessionClient).revokeSession(targetSession);
        }
    }

    @Nested
    class FileImport {

        @Test
        void shouldValidateAndImportCsv() throws Exception {
            String csv = "firstname,lastname,email,employeeno\nJohn,Doe,john@test.com,EMP001\n";
            MockMultipartFile file = new MockMultipartFile(
                    "file", "users.csv", "text/csv", csv.getBytes());

            mockMvc.perform(multipart("/api/v1/bff/users/import")
                            .file(file)
                            .with(authentication(adminAuth()))
                            .with(csrf()))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.data.totalRows").value(1))
                    .andExpect(jsonPath("$.data.validRows").value(1))
                    .andExpect(jsonPath("$.data.errors", hasSize(0)));
        }

        @Test
        void shouldRejectCsvWithMissingColumns() throws Exception {
            String csv = "name,department\nJohn,Engineering\n";
            MockMultipartFile file = new MockMultipartFile(
                    "file", "users.csv", "text/csv", csv.getBytes());

            mockMvc.perform(multipart("/api/v1/bff/users/import")
                            .file(file)
                            .with(authentication(adminAuth()))
                            .with(csrf()))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.data.errors", hasSize(greaterThan(0))));
        }

        @Test
        void shouldRejectImportForNonAdmin() throws Exception {
            MockMultipartFile file = new MockMultipartFile(
                    "file", "users.csv", "text/csv", "data".getBytes());

            mockMvc.perform(multipart("/api/v1/bff/users/import")
                            .file(file)
                            .with(authentication(userAuth()))
                            .with(csrf()))
                    .andExpect(status().isForbidden());
        }
    }
}
