package io.innait.wiam.adminbff.service;

import io.innait.wiam.adminbff.client.AuditServiceClient;
import io.innait.wiam.adminbff.client.IdentityServiceClient;
import io.innait.wiam.adminbff.client.SessionServiceClient;
import io.innait.wiam.adminbff.dto.DashboardResponse;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class DashboardServiceTest {

    @Mock private IdentityServiceClient identityClient;
    @Mock private SessionServiceClient sessionClient;
    @Mock private AuditServiceClient auditClient;

    private DashboardService dashboardService;

    @BeforeEach
    void setUp() {
        dashboardService = new DashboardService(identityClient, sessionClient, auditClient);
    }

    @Nested
    class DashboardAggregation {

        @Test
        void shouldAggregateAllWidgets() {
            when(identityClient.getUserCountsByStatus()).thenReturn(Map.of(
                    "active", 150, "suspended", 5, "locked", 3, "terminated", 10, "total", 168));
            when(sessionClient.getActiveSessionCount()).thenReturn(42L);
            when(auditClient.getRecentAdminActions(10)).thenReturn(List.of(
                    Map.of("actionType", "USER_CREATED", "adminId", "admin-1")));
            when(auditClient.getAuthStats()).thenReturn(Map.of(
                    "successCount", 1200L, "failureCount", 30L, "successRate", 97.56, "totalAttempts", 1230L));

            DashboardResponse result = dashboardService.getDashboard();

            assertThat(result.userCounts().active()).isEqualTo(150);
            assertThat(result.userCounts().total()).isEqualTo(168);
            assertThat(result.activeSessionCount()).isEqualTo(42);
            assertThat(result.recentAdminActions()).hasSize(1);
            assertThat(result.authStats().successCount()).isEqualTo(1200);
            assertThat(result.authStats().successRate()).isEqualTo(97.56);
        }

        @Test
        void shouldReturnDefaultsWhenIdentityServiceFails() {
            when(identityClient.getUserCountsByStatus()).thenThrow(new RuntimeException("Connection refused"));
            when(sessionClient.getActiveSessionCount()).thenReturn(10L);
            when(auditClient.getRecentAdminActions(10)).thenReturn(List.of());
            when(auditClient.getAuthStats()).thenReturn(Map.of());

            DashboardResponse result = dashboardService.getDashboard();

            assertThat(result.userCounts().total()).isZero();
            assertThat(result.activeSessionCount()).isEqualTo(10);
        }

        @Test
        void shouldReturnDefaultsWhenSessionServiceFails() {
            when(identityClient.getUserCountsByStatus()).thenReturn(Map.of("active", 50, "total", 50));
            when(sessionClient.getActiveSessionCount()).thenReturn(0L);
            when(auditClient.getRecentAdminActions(10)).thenReturn(List.of());
            when(auditClient.getAuthStats()).thenReturn(Map.of());

            DashboardResponse result = dashboardService.getDashboard();

            assertThat(result.userCounts().active()).isEqualTo(50);
            assertThat(result.activeSessionCount()).isZero();
        }

        @Test
        void shouldReturnDefaultsWhenAllServicesFail() {
            when(identityClient.getUserCountsByStatus()).thenThrow(new RuntimeException("down"));
            when(sessionClient.getActiveSessionCount()).thenReturn(0L);
            when(auditClient.getRecentAdminActions(10)).thenThrow(new RuntimeException("down"));
            when(auditClient.getAuthStats()).thenThrow(new RuntimeException("down"));

            DashboardResponse result = dashboardService.getDashboard();

            assertThat(result.userCounts().total()).isZero();
            assertThat(result.activeSessionCount()).isZero();
            assertThat(result.recentAdminActions()).isEmpty();
            assertThat(result.authStats().totalAttempts()).isZero();
        }
    }
}
