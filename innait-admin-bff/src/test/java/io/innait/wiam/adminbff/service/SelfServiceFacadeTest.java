package io.innait.wiam.adminbff.service;

import io.innait.wiam.adminbff.client.AuditServiceClient;
import io.innait.wiam.adminbff.client.CredentialServiceClient;
import io.innait.wiam.adminbff.client.IdentityServiceClient;
import io.innait.wiam.adminbff.client.SessionServiceClient;
import io.innait.wiam.adminbff.dto.ChangePasswordRequest;
import io.innait.wiam.adminbff.dto.UpdateProfileRequest;
import io.innait.wiam.common.security.InnaITAuthenticationToken;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SelfServiceFacadeTest {

    @Mock private IdentityServiceClient identityClient;
    @Mock private CredentialServiceClient credentialClient;
    @Mock private SessionServiceClient sessionClient;
    @Mock private AuditServiceClient auditClient;

    private SelfServiceFacade facade;

    private static final UUID USER_ID = UUID.randomUUID();
    private static final UUID TENANT_ID = UUID.randomUUID();
    private static final UUID SESSION_ID = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        facade = new SelfServiceFacade(identityClient, credentialClient, sessionClient, auditClient);
        setSecurityContext();
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    private void setSecurityContext() {
        InnaITAuthenticationToken token = new InnaITAuthenticationToken(
                "user@test.com", TENANT_ID, USER_ID, "user@test.com", SESSION_ID,
                List.of("USER"), List.of(), List.of("pwd"), "urn:innait:acr:pwd",
                "mock-raw-token",
                List.of(new SimpleGrantedAuthority("ROLE_USER"))
        );
        SecurityContextHolder.getContext().setAuthentication(token);
    }

    @Nested
    class ProfileAccess {

        @Test
        void shouldGetOwnProfile() {
            Map<String, Object> profile = Map.of("userId", USER_ID.toString(), "email", "user@test.com");
            when(identityClient.getUserProfile(USER_ID)).thenReturn(profile);

            Map<String, Object> result = facade.getMyProfile();

            assertThat(result).containsEntry("email", "user@test.com");
            verify(identityClient).getUserProfile(USER_ID);
        }

        @Test
        void shouldUpdateOwnProfile() {
            UpdateProfileRequest request = new UpdateProfileRequest(
                    "Jane", "Doe", "+91", "9876543210", "en", "Asia/Kolkata");
            when(identityClient.updateUserProfile(eq(USER_ID), any())).thenReturn(
                    Map.of("firstName", "Jane", "lastName", "Doe"));

            Map<String, Object> result = facade.updateMyProfile(request);

            assertThat(result).containsEntry("firstName", "Jane");
            verify(identityClient).updateUserProfile(eq(USER_ID), any());
        }
    }

    @Nested
    class PasswordChange {

        @Test
        void shouldDelegatePasswordChangeToCredentialService() {
            ChangePasswordRequest request = new ChangePasswordRequest("oldPass", "newPass123!");

            facade.changePassword(request);

            verify(credentialClient).changePassword(any());
        }
    }

    @Nested
    class SessionManagement {

        @Test
        void shouldListOwnSessions() {
            when(sessionClient.getAccountSessions(SESSION_ID)).thenReturn(
                    List.of(Map.of("sessionId", "s1", "sessionStatus", "ACTIVE")));

            List<Map<String, Object>> sessions = facade.getMySessions();

            assertThat(sessions).hasSize(1);
        }

        @Test
        void shouldRevokeOwnSession() {
            UUID targetSession = UUID.randomUUID();
            when(sessionClient.getAccountSessions(SESSION_ID)).thenReturn(
                    List.of(Map.of("sessionId", targetSession.toString())));

            facade.revokeMySession(targetSession);

            verify(sessionClient).revokeSession(targetSession);
        }

        @Test
        void shouldRejectRevokingOtherUserSession() {
            UUID otherSession = UUID.randomUUID();
            when(sessionClient.getAccountSessions(SESSION_ID)).thenReturn(
                    List.of(Map.of("sessionId", UUID.randomUUID().toString())));

            assertThatThrownBy(() -> facade.revokeMySession(otherSession))
                    .isInstanceOf(AccessDeniedException.class)
                    .hasMessageContaining("does not belong to you");
        }
    }

    @Nested
    class ActivityTrail {

        @Test
        void shouldGetOwnActivity() {
            when(auditClient.getUserAuditTrail(USER_ID, 50)).thenReturn(
                    List.of(Map.of("eventType", "LOGIN")));

            List<Map<String, Object>> activity = facade.getMyActivity();

            assertThat(activity).hasSize(1);
            verify(auditClient).getUserAuditTrail(USER_ID, 50);
        }
    }
}
