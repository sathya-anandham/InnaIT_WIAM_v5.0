package io.innait.wiam.adminbff.service;

import io.innait.wiam.adminbff.client.CredentialServiceClient;
import io.innait.wiam.adminbff.client.IdentityServiceClient;
import io.innait.wiam.adminbff.client.SessionServiceClient;
import io.innait.wiam.adminbff.client.TokenServiceClient;
import io.innait.wiam.adminbff.dto.RecoveryRequest;
import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class AccountRecoveryService {

    private static final Logger log = LoggerFactory.getLogger(AccountRecoveryService.class);

    private final CredentialServiceClient credentialClient;
    private final IdentityServiceClient identityClient;
    private final SessionServiceClient sessionClient;
    private final TokenServiceClient tokenClient;

    public AccountRecoveryService(CredentialServiceClient credentialClient,
                                   IdentityServiceClient identityClient,
                                   SessionServiceClient sessionClient,
                                   TokenServiceClient tokenClient) {
        this.credentialClient = credentialClient;
        this.identityClient = identityClient;
        this.sessionClient = sessionClient;
        this.tokenClient = tokenClient;
    }

    /**
     * Recovers an account using a backup code. Creates a session with reduced ACR
     * and issues tokens with limited access.
     */
    @SuppressWarnings("unchecked")
    public Map<String, Object> recoverWithBackupCode(RecoveryRequest request, HttpServletRequest httpRequest) {
        // Look up user by loginId
        Map<String, Object> user = identityClient.lookupByLoginId(request.loginId());
        if (user == null) {
            throw new BadCredentialsException("Invalid credentials.");
        }

        UUID userId = extractUuid(user, "userId");
        UUID tenantId = extractUuid(user, "tenantId");
        if (userId == null || tenantId == null) {
            throw new BadCredentialsException("Invalid credentials.");
        }

        // Get the first account for this user
        List<Map<String, Object>> accounts = null;
        try {
            accounts = identityClient.getUserAccounts(userId);
        } catch (Exception e) {
            log.debug("Failed to get user accounts: {}", e.getMessage());
        }

        UUID accountId;
        if (accounts != null && !accounts.isEmpty()) {
            accountId = extractUuid(accounts.getFirst(), "accountId");
            if (accountId == null) accountId = userId;
        } else {
            accountId = userId;
        }

        // Verify backup code
        boolean valid = credentialClient.verifyBackupCode(accountId, request.backupCode());
        if (!valid) {
            log.warn("Invalid backup code attempt for loginId [{}]", request.loginId());
            throw new BadCredentialsException("Invalid credentials.");
        }

        // Create reduced-ACR session
        String ipAddress = httpRequest.getRemoteAddr();
        String userAgent = httpRequest.getHeader("User-Agent");

        Map<String, Object> sessionRequest = Map.of(
                "accountId", accountId.toString(),
                "authMethodsUsed", List.of("BACKUP_CODE"),
                "acrLevel", 1,
                "sessionType", "INTERACTIVE",
                "ipAddress", ipAddress != null ? ipAddress : "unknown",
                "userAgent", userAgent != null ? userAgent : "unknown"
        );

        Map<String, Object> sessionResponse = sessionClient.createSession(sessionRequest);
        UUID sessionId = extractUuid(sessionResponse, "sessionId");
        if (sessionId == null) {
            throw new IllegalStateException("Failed to create recovery session.");
        }

        // Issue tokens with reduced ACR
        List<String> roles = (List<String>) user.getOrDefault("roles", List.of("USER"));
        Map<String, Object> tokenResponse = tokenClient.issueToken(
                sessionId, accountId, tenantId, request.loginId(),
                roles, List.of("backup_code"), "urn:innait:acr:backup");

        String accessToken = tokenResponse != null ? (String) tokenResponse.get("accessToken") : null;

        log.info("Account recovery successful for loginId [{}] via backup code", request.loginId());

        return Map.of(
                "accessToken", accessToken != null ? accessToken : "",
                "sessionId", sessionId.toString(),
                "reducedAccess", true,
                "message", "Account recovered with reduced access. Please re-enroll your MFA."
        );
    }

    private UUID extractUuid(Map<String, Object> data, String key) {
        if (data == null) return null;
        Object value = data.get(key);
        if (value instanceof UUID uuid) return uuid;
        if (value instanceof String str) {
            try {
                return UUID.fromString(str);
            } catch (IllegalArgumentException e) {
                return null;
            }
        }
        return null;
    }
}
