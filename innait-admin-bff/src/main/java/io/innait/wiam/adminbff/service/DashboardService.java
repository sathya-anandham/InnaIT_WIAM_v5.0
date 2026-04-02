package io.innait.wiam.adminbff.service;

import io.innait.wiam.adminbff.client.AuditServiceClient;
import io.innait.wiam.adminbff.client.IdentityServiceClient;
import io.innait.wiam.adminbff.client.SessionServiceClient;
import io.innait.wiam.adminbff.dto.AuthStatsResponse;
import io.innait.wiam.adminbff.dto.DashboardResponse;
import io.innait.wiam.adminbff.dto.UserCountsByStatus;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;

@Service
public class DashboardService {

    private static final Logger log = LoggerFactory.getLogger(DashboardService.class);

    private final IdentityServiceClient identityClient;
    private final SessionServiceClient sessionClient;
    private final AuditServiceClient auditClient;

    public DashboardService(IdentityServiceClient identityClient,
                            SessionServiceClient sessionClient,
                            AuditServiceClient auditClient) {
        this.identityClient = identityClient;
        this.sessionClient = sessionClient;
        this.auditClient = auditClient;
    }

    public DashboardResponse getDashboard() {
        // Execute all 4 downstream calls in parallel
        CompletableFuture<Map<String, Object>> userCountsFuture =
                CompletableFuture.supplyAsync(() -> {
                    try {
                        return identityClient.getUserCountsByStatus();
                    } catch (Exception e) {
                        log.warn("Failed to get user counts: {}", e.getMessage());
                        return Map.of();
                    }
                });

        CompletableFuture<Long> sessionCountFuture =
                CompletableFuture.supplyAsync(() -> {
                    try {
                        return sessionClient.getActiveSessionCount();
                    } catch (Exception e) {
                        log.warn("Failed to get session count: {}", e.getMessage());
                        return 0L;
                    }
                });

        CompletableFuture<List<Map<String, Object>>> adminActionsFuture =
                CompletableFuture.supplyAsync(() -> {
                    try {
                        return auditClient.getRecentAdminActions(10);
                    } catch (Exception e) {
                        log.warn("Failed to get admin actions: {}", e.getMessage());
                        return List.of();
                    }
                });

        CompletableFuture<Map<String, Object>> authStatsFuture =
                CompletableFuture.supplyAsync(() -> {
                    try {
                        return auditClient.getAuthStats();
                    } catch (Exception e) {
                        log.warn("Failed to get auth stats: {}", e.getMessage());
                        return Map.of();
                    }
                });

        // Wait for all to complete
        CompletableFuture.allOf(userCountsFuture, sessionCountFuture,
                adminActionsFuture, authStatsFuture).join();

        return new DashboardResponse(
                UserCountsByStatus.fromMap(userCountsFuture.join()),
                sessionCountFuture.join(),
                adminActionsFuture.join(),
                AuthStatsResponse.fromMap(authStatsFuture.join())
        );
    }
}
