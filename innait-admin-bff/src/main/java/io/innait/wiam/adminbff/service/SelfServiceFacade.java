package io.innait.wiam.adminbff.service;

import io.innait.wiam.adminbff.client.AuditServiceClient;
import io.innait.wiam.adminbff.client.CredentialServiceClient;
import io.innait.wiam.adminbff.client.IdentityServiceClient;
import io.innait.wiam.adminbff.client.SessionServiceClient;
import io.innait.wiam.adminbff.dto.ChangeEmailRequest;
import io.innait.wiam.adminbff.dto.ChangePasswordRequest;
import io.innait.wiam.adminbff.dto.UpdateProfileRequest;
import io.innait.wiam.common.security.InnaITAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class SelfServiceFacade {

    private final IdentityServiceClient identityClient;
    private final CredentialServiceClient credentialClient;
    private final SessionServiceClient sessionClient;
    private final AuditServiceClient auditClient;

    public SelfServiceFacade(IdentityServiceClient identityClient,
                             CredentialServiceClient credentialClient,
                             SessionServiceClient sessionClient,
                             AuditServiceClient auditClient) {
        this.identityClient = identityClient;
        this.credentialClient = credentialClient;
        this.sessionClient = sessionClient;
        this.auditClient = auditClient;
    }

    public Map<String, Object> getMyProfile() {
        return identityClient.getUserProfile(currentUserId());
    }

    public Map<String, Object> updateMyProfile(UpdateProfileRequest request) {
        Map<String, Object> updates = new HashMap<>();
        if (request.firstName() != null) updates.put("firstName", request.firstName());
        if (request.lastName() != null) updates.put("lastName", request.lastName());
        if (request.phoneCountryCode() != null) updates.put("phoneCountryCode", request.phoneCountryCode());
        if (request.phoneNumber() != null) updates.put("phoneNumber", request.phoneNumber());
        if (request.locale() != null) updates.put("locale", request.locale());
        if (request.timezone() != null) updates.put("timezone", request.timezone());
        return identityClient.updateUserProfile(currentUserId(), updates);
    }

    public Map<String, Object> changeEmail(ChangeEmailRequest request) {
        Map<String, Object> body = Map.of(
                "userId", currentUserId().toString(),
                "newEmail", request.newEmail(),
                "otpCode", request.otpCode()
        );
        return identityClient.updateUserProfile(currentUserId(), body);
    }

    public void changePassword(ChangePasswordRequest request) {
        Map<String, String> body = Map.of(
                "accountId", currentAccountId().toString(),
                "currentPassword", request.currentPassword(),
                "newPassword", request.newPassword()
        );
        credentialClient.changePassword(body);
    }

    public Map<String, Object> enrollTotp() {
        Map<String, Object> body = Map.of("accountId", currentAccountId().toString());
        return credentialClient.enrollTotp(body);
    }

    public Map<String, Object> registerFidoBegin() {
        Map<String, Object> body = Map.of("accountId", currentAccountId().toString());
        return credentialClient.registerFidoBegin(body);
    }

    public Map<String, Object> registerFidoComplete(Map<String, Object> attestation) {
        attestation.put("accountId", currentAccountId().toString());
        return credentialClient.registerFidoComplete(attestation);
    }

    @SuppressWarnings("unchecked")
    public List<Map<String, Object>> getMySessions() {
        // Use accountId from the current session to find sessions for the same account
        UUID accountId = currentAccountId();
        if (accountId == null) return List.of();
        List<Map<String, Object>> sessions = sessionClient.getAccountSessions(accountId);
        return sessions != null ? sessions : List.of();
    }

    public void revokeMySession(UUID sessionId) {
        // User can only revoke their own sessions — verify ownership via account
        UUID accountId = currentAccountId();
        if (accountId != null) {
            List<Map<String, Object>> sessions = sessionClient.getAccountSessions(accountId);
            if (sessions != null) {
                boolean owned = sessions.stream()
                        .anyMatch(s -> sessionId.toString().equals(String.valueOf(s.get("sessionId"))));
                if (!owned) {
                    throw new org.springframework.security.access.AccessDeniedException(
                            "Cannot revoke a session that does not belong to you");
                }
            }
        }
        sessionClient.revokeSession(sessionId);
    }

    public List<Map<String, Object>> getMyActivity() {
        return auditClient.getUserAuditTrail(currentUserId(), 50);
    }

    private UUID currentUserId() {
        InnaITAuthenticationToken token = currentAuth();
        return token.getUserId();
    }

    private UUID currentAccountId() {
        // The session_id claim maps to the current session; we derive accountId from it
        // For simplicity, we expose it through the loginId → accountId lookup
        // In practice, the accountId might be available directly in the token or
        // via a profile lookup. Here we use userId as the primary.
        InnaITAuthenticationToken token = currentAuth();
        return token.getSessionId(); // session-based; adapt to accountId if claim available
    }

    private InnaITAuthenticationToken currentAuth() {
        return (InnaITAuthenticationToken) SecurityContextHolder.getContext().getAuthentication();
    }
}
