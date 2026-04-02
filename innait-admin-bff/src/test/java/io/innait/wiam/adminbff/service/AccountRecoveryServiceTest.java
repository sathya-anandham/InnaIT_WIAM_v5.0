package io.innait.wiam.adminbff.service;

import io.innait.wiam.adminbff.client.CredentialServiceClient;
import io.innait.wiam.adminbff.client.IdentityServiceClient;
import io.innait.wiam.adminbff.client.SessionServiceClient;
import io.innait.wiam.adminbff.client.TokenServiceClient;
import io.innait.wiam.adminbff.dto.RecoveryRequest;
import jakarta.servlet.http.HttpServletRequest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.BadCredentialsException;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AccountRecoveryServiceTest {

    @Mock private CredentialServiceClient credentialClient;
    @Mock private IdentityServiceClient identityClient;
    @Mock private SessionServiceClient sessionClient;
    @Mock private TokenServiceClient tokenClient;
    @Mock private HttpServletRequest httpRequest;

    @Captor private ArgumentCaptor<Map<String, Object>> sessionRequestCaptor;

    private AccountRecoveryService service;

    private static final UUID USER_ID = UUID.randomUUID();
    private static final UUID TENANT_ID = UUID.randomUUID();
    private static final UUID SESSION_ID = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        service = new AccountRecoveryService(credentialClient, identityClient,
                sessionClient, tokenClient);
        when(httpRequest.getRemoteAddr()).thenReturn("192.168.1.1");
        when(httpRequest.getHeader("User-Agent")).thenReturn("TestBrowser/1.0");
    }

    @Nested
    class BackupCodeRecovery {

        @Test
        void shouldRecoverWithValidBackupCode() {
            when(identityClient.lookupByLoginId("john@test.com")).thenReturn(
                    Map.of("userId", USER_ID.toString(), "tenantId", TENANT_ID.toString()));
            when(identityClient.getUserAccounts(USER_ID)).thenReturn(
                    List.of(Map.of("accountId", USER_ID.toString())));
            when(credentialClient.verifyBackupCode(USER_ID, "ABCD1234")).thenReturn(true);
            when(sessionClient.createSession(any())).thenReturn(
                    Map.of("sessionId", SESSION_ID.toString()));
            when(tokenClient.issueToken(any(), any(), any(), anyString(), anyList(), anyList(), anyString()))
                    .thenReturn(Map.of("accessToken", "mock-access-token"));

            Map<String, Object> result = service.recoverWithBackupCode(
                    new RecoveryRequest("john@test.com", "ABCD1234"), httpRequest);

            assertThat(result).containsEntry("reducedAccess", true);
            assertThat(result).containsEntry("accessToken", "mock-access-token");
            assertThat(result).containsEntry("sessionId", SESSION_ID.toString());
        }

        @Test
        void shouldRejectInvalidBackupCode() {
            when(identityClient.lookupByLoginId("john@test.com")).thenReturn(
                    Map.of("userId", USER_ID.toString(), "tenantId", TENANT_ID.toString()));
            when(identityClient.getUserAccounts(USER_ID)).thenReturn(
                    List.of(Map.of("accountId", USER_ID.toString())));
            when(credentialClient.verifyBackupCode(USER_ID, "WRONGCODE")).thenReturn(false);

            assertThatThrownBy(() -> service.recoverWithBackupCode(
                    new RecoveryRequest("john@test.com", "WRONGCODE"), httpRequest))
                    .isInstanceOf(BadCredentialsException.class)
                    .hasMessageContaining("Invalid credentials");
        }

        @Test
        void shouldRejectUnknownLoginId() {
            when(identityClient.lookupByLoginId("unknown@test.com")).thenReturn(null);

            assertThatThrownBy(() -> service.recoverWithBackupCode(
                    new RecoveryRequest("unknown@test.com", "ABCD1234"), httpRequest))
                    .isInstanceOf(BadCredentialsException.class)
                    .hasMessageContaining("Invalid credentials");
        }

        @Test
        void shouldCreateSessionWithReducedAcr() {
            when(identityClient.lookupByLoginId("john@test.com")).thenReturn(
                    Map.of("userId", USER_ID.toString(), "tenantId", TENANT_ID.toString()));
            when(identityClient.getUserAccounts(USER_ID)).thenReturn(
                    List.of(Map.of("accountId", USER_ID.toString())));
            when(credentialClient.verifyBackupCode(USER_ID, "ABCD1234")).thenReturn(true);
            when(sessionClient.createSession(any())).thenReturn(
                    Map.of("sessionId", SESSION_ID.toString()));
            when(tokenClient.issueToken(any(), any(), any(), anyString(), anyList(), anyList(), anyString()))
                    .thenReturn(Map.of("accessToken", "token"));

            service.recoverWithBackupCode(
                    new RecoveryRequest("john@test.com", "ABCD1234"), httpRequest);

            verify(sessionClient).createSession(sessionRequestCaptor.capture());
            Map<String, Object> sessionReq = sessionRequestCaptor.getValue();
            assertThat(sessionReq).containsEntry("acrLevel", 1);
            assertThat(sessionReq.get("authMethodsUsed")).isEqualTo(List.of("BACKUP_CODE"));
        }

        @Test
        void shouldIssueTokensWithBackupCodeAmr() {
            when(identityClient.lookupByLoginId("john@test.com")).thenReturn(
                    Map.of("userId", USER_ID.toString(), "tenantId", TENANT_ID.toString()));
            when(identityClient.getUserAccounts(USER_ID)).thenReturn(
                    List.of(Map.of("accountId", USER_ID.toString())));
            when(credentialClient.verifyBackupCode(USER_ID, "ABCD1234")).thenReturn(true);
            when(sessionClient.createSession(any())).thenReturn(
                    Map.of("sessionId", SESSION_ID.toString()));
            when(tokenClient.issueToken(any(), any(), any(), anyString(), anyList(), anyList(), anyString()))
                    .thenReturn(Map.of("accessToken", "token"));

            service.recoverWithBackupCode(
                    new RecoveryRequest("john@test.com", "ABCD1234"), httpRequest);

            verify(tokenClient).issueToken(
                    eq(SESSION_ID), eq(USER_ID), eq(TENANT_ID),
                    eq("john@test.com"),
                    anyList(),
                    eq(List.of("backup_code")),
                    eq("urn:innait:acr:backup"));
        }
    }
}
