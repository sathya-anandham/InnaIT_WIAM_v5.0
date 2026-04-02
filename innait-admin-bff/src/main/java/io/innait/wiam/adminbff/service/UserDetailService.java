package io.innait.wiam.adminbff.service;

import io.innait.wiam.adminbff.client.AuditServiceClient;
import io.innait.wiam.adminbff.client.CredentialServiceClient;
import io.innait.wiam.adminbff.client.IdentityServiceClient;
import io.innait.wiam.adminbff.client.SessionServiceClient;
import io.innait.wiam.adminbff.dto.UserDetailResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;

@Service
public class UserDetailService {

    private static final Logger log = LoggerFactory.getLogger(UserDetailService.class);

    private final IdentityServiceClient identityClient;
    private final CredentialServiceClient credentialClient;
    private final SessionServiceClient sessionClient;
    private final AuditServiceClient auditClient;

    public UserDetailService(IdentityServiceClient identityClient,
                             CredentialServiceClient credentialClient,
                             SessionServiceClient sessionClient,
                             AuditServiceClient auditClient) {
        this.identityClient = identityClient;
        this.credentialClient = credentialClient;
        this.sessionClient = sessionClient;
        this.auditClient = auditClient;
    }

    @SuppressWarnings("unchecked")
    public UserDetailResponse getUserDetail(UUID userId) {
        // 1. Get user profile (needed to extract accountId for other calls)
        CompletableFuture<Map<String, Object>> profileFuture =
                CompletableFuture.supplyAsync(() -> safeCall(() -> identityClient.getUserProfile(userId)));

        // Wait for profile to get accountId, then launch parallel calls
        Map<String, Object> profile = profileFuture.join();
        UUID accountId = extractFirstAccountId(profile);

        // 2. Launch remaining calls in parallel
        CompletableFuture<List<Map<String, Object>>> accountsFuture =
                CompletableFuture.supplyAsync(() -> safeCall(() -> identityClient.getUserAccounts(userId)));

        CompletableFuture<List<Map<String, Object>>> rolesFuture =
                CompletableFuture.supplyAsync(() -> {
                    if (accountId == null) return List.<Map<String, Object>>of();
                    return safeCall(() -> identityClient.getAccountRoles(accountId));
                });

        CompletableFuture<Map<String, Object>> credentialFuture =
                CompletableFuture.supplyAsync(() -> {
                    if (accountId == null) return Map.<String, Object>of();
                    return safeCall(() -> credentialClient.getCredentialOverview(accountId));
                });

        CompletableFuture<List<Map<String, Object>>> sessionsFuture =
                CompletableFuture.supplyAsync(() -> {
                    if (accountId == null) return List.<Map<String, Object>>of();
                    return safeCall(() -> sessionClient.getAccountSessions(accountId));
                });

        CompletableFuture<List<Map<String, Object>>> auditFuture =
                CompletableFuture.supplyAsync(() -> safeCall(() -> auditClient.getUserAuditTrail(userId, 50)));

        CompletableFuture.allOf(accountsFuture, rolesFuture, credentialFuture,
                sessionsFuture, auditFuture).join();

        return new UserDetailResponse(
                profile,
                accountsFuture.join(),
                rolesFuture.join(),
                credentialFuture.join(),
                sessionsFuture.join(),
                auditFuture.join()
        );
    }

    @SuppressWarnings("unchecked")
    private UUID extractFirstAccountId(Map<String, Object> profile) {
        if (profile == null || !profile.containsKey("accounts")) return null;
        List<Map<String, Object>> accounts = (List<Map<String, Object>>) profile.get("accounts");
        if (accounts == null || accounts.isEmpty()) return null;
        Object id = accounts.getFirst().get("accountId");
        if (id instanceof String s) return UUID.fromString(s);
        return null;
    }

    private <T> T safeCall(java.util.function.Supplier<T> call) {
        try {
            return call.get();
        } catch (Exception e) {
            log.warn("Downstream call failed: {}", e.getMessage());
            return null;
        }
    }
}
