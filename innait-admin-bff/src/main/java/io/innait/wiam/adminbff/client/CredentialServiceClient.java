package io.innait.wiam.adminbff.client;

import io.innait.wiam.adminbff.config.BffProperties;
import io.innait.wiam.common.dto.ApiResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@Component
public class CredentialServiceClient {

    private static final Logger log = LoggerFactory.getLogger(CredentialServiceClient.class);

    private final RestTemplate restTemplate;
    private final String baseUrl;

    public CredentialServiceClient(RestTemplate restTemplate, BffProperties props) {
        this.restTemplate = restTemplate;
        this.baseUrl = props.getCredentialUrl();
    }

    public void changePassword(Map<String, String> request) {
        restTemplate.postForEntity(
                baseUrl + "/api/v1/credentials/password/change",
                request, ApiResponse.class);
    }

    public Map<String, Object> enrollTotp(Map<String, Object> request) {
        ResponseEntity<ApiResponse<Map<String, Object>>> resp = restTemplate.exchange(
                baseUrl + "/api/v1/credentials/totp/enroll",
                HttpMethod.POST,
                new HttpEntity<>(request),
                new ParameterizedTypeReference<>() {});
        return extractData(resp);
    }

    public Map<String, Object> registerFidoBegin(Map<String, Object> request) {
        ResponseEntity<ApiResponse<Map<String, Object>>> resp = restTemplate.exchange(
                baseUrl + "/api/v1/credentials/fido/register/begin",
                HttpMethod.POST,
                new HttpEntity<>(request),
                new ParameterizedTypeReference<>() {});
        return extractData(resp);
    }

    public Map<String, Object> registerFidoComplete(Map<String, Object> request) {
        ResponseEntity<ApiResponse<Map<String, Object>>> resp = restTemplate.exchange(
                baseUrl + "/api/v1/credentials/fido/register/complete",
                HttpMethod.POST,
                new HttpEntity<>(request),
                new ParameterizedTypeReference<>() {});
        return extractData(resp);
    }

    @SuppressWarnings("unchecked")
    public Map<String, Object> getCredentialOverview(UUID accountId) {
        // Aggregate credential status for the account
        boolean hasPassword = false;
        boolean hasTotp = false;
        boolean hasFido = false;
        int fidoKeyCount = 0;
        boolean hasBackupCodes = false;
        int backupCodesRemaining = 0;

        try {
            // Check FIDO credentials
            ResponseEntity<ApiResponse<List<Map<String, Object>>>> fidoResp = restTemplate.exchange(
                    baseUrl + "/api/v1/credentials/fido?accountId={accountId}",
                    HttpMethod.GET, null,
                    new ParameterizedTypeReference<>() {},
                    accountId);
            List<Map<String, Object>> fidoKeys = extractData(fidoResp);
            if (fidoKeys != null && !fidoKeys.isEmpty()) {
                hasFido = true;
                fidoKeyCount = fidoKeys.size();
            }
        } catch (Exception e) {
            log.debug("Failed to get FIDO credentials: {}", e.getMessage());
        }

        try {
            // Check backup codes remaining
            ResponseEntity<ApiResponse<Map<String, Integer>>> backupResp = restTemplate.exchange(
                    baseUrl + "/api/v1/credentials/backup-codes/remaining?accountId={accountId}",
                    HttpMethod.GET, null,
                    new ParameterizedTypeReference<>() {},
                    accountId);
            Map<String, Integer> remaining = extractData(backupResp);
            if (remaining != null && remaining.containsKey("remaining")) {
                backupCodesRemaining = remaining.get("remaining");
                hasBackupCodes = backupCodesRemaining > 0;
            }
        } catch (Exception e) {
            log.debug("Failed to get backup codes: {}", e.getMessage());
        }

        return Map.of(
                "hasPassword", hasPassword,
                "hasTotp", hasTotp,
                "hasFido", hasFido,
                "fidoKeyCount", fidoKeyCount,
                "hasBackupCodes", hasBackupCodes,
                "backupCodesRemaining", backupCodesRemaining
        );
    }

    public void resetPassword(UUID accountId, String newPassword, UUID forcedBy) {
        Map<String, String> request = Map.of(
                "accountId", accountId.toString(),
                "newPassword", newPassword,
                "forcedBy", forcedBy.toString()
        );
        restTemplate.postForEntity(
                baseUrl + "/api/v1/credentials/password/reset",
                request, Void.class);
    }

    public boolean verifyBackupCode(UUID accountId, String code) {
        try {
            Map<String, String> request = Map.of(
                    "accountId", accountId.toString(),
                    "code", code
            );
            ResponseEntity<ApiResponse<Map<String, Object>>> resp = restTemplate.exchange(
                    baseUrl + "/api/v1/credentials/backup-codes/verify",
                    HttpMethod.POST,
                    new HttpEntity<>(request),
                    new ParameterizedTypeReference<>() {});
            Map<String, Object> data = extractData(resp);
            return data != null && Boolean.TRUE.equals(data.get("valid"));
        } catch (Exception e) {
            log.debug("Backup code verification failed: {}", e.getMessage());
            return false;
        }
    }

    public void enrollPassword(UUID accountId, String password) {
        Map<String, String> request = Map.of(
                "accountId", accountId.toString(),
                "password", password
        );
        restTemplate.postForEntity(
                baseUrl + "/api/v1/credentials/password/enroll",
                request, Void.class);
    }

    public Map<String, Object> confirmTotp(Map<String, Object> request) {
        ResponseEntity<ApiResponse<Map<String, Object>>> resp = restTemplate.exchange(
                baseUrl + "/api/v1/credentials/totp/confirm",
                HttpMethod.POST,
                new HttpEntity<>(request),
                new ParameterizedTypeReference<>() {});
        return extractData(resp);
    }

    private <T> T extractData(ResponseEntity<ApiResponse<T>> resp) {
        if (resp.getBody() != null) {
            return resp.getBody().data();
        }
        return null;
    }
}
