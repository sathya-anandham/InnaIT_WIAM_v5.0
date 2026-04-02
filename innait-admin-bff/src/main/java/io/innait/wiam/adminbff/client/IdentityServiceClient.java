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
public class IdentityServiceClient {

    private static final Logger log = LoggerFactory.getLogger(IdentityServiceClient.class);

    private final RestTemplate restTemplate;
    private final String baseUrl;

    public IdentityServiceClient(RestTemplate restTemplate, BffProperties props) {
        this.restTemplate = restTemplate;
        this.baseUrl = props.getIdentityUrl();
    }

    public Map<String, Object> getUserProfile(UUID userId) {
        ResponseEntity<ApiResponse<Map<String, Object>>> resp = restTemplate.exchange(
                baseUrl + "/api/v1/identity/users/{userId}",
                HttpMethod.GET, null,
                new ParameterizedTypeReference<>() {},
                userId);
        return extractData(resp);
    }

    @SuppressWarnings("unchecked")
    public List<Map<String, Object>> getUserAccounts(UUID userId) {
        ResponseEntity<ApiResponse<Map<String, Object>>> resp = restTemplate.exchange(
                baseUrl + "/api/v1/identity/users/{userId}",
                HttpMethod.GET, null,
                new ParameterizedTypeReference<>() {},
                userId);
        Map<String, Object> user = extractData(resp);
        if (user != null && user.containsKey("accounts")) {
            return (List<Map<String, Object>>) user.get("accounts");
        }
        return List.of();
    }

    @SuppressWarnings("unchecked")
    public List<Map<String, Object>> getAccountRoles(UUID accountId) {
        ResponseEntity<ApiResponse<List<Map<String, Object>>>> resp = restTemplate.exchange(
                baseUrl + "/api/v1/identity/accounts/{accountId}/roles",
                HttpMethod.GET, null,
                new ParameterizedTypeReference<>() {},
                accountId);
        return extractData(resp);
    }

    @SuppressWarnings("unchecked")
    public Map<String, Object> searchUsers(Map<String, String> params) {
        StringBuilder url = new StringBuilder(baseUrl + "/api/v1/identity/users?");
        params.forEach((k, v) -> url.append(k).append("=").append(v).append("&"));

        ResponseEntity<ApiResponse<Map<String, Object>>> resp = restTemplate.exchange(
                url.toString(), HttpMethod.GET, null,
                new ParameterizedTypeReference<>() {});
        return extractData(resp);
    }

    public Map<String, Object> getUserCountsByStatus() {
        ResponseEntity<ApiResponse<Map<String, Object>>> resp = restTemplate.exchange(
                baseUrl + "/api/v1/identity/users/counts",
                HttpMethod.GET, null,
                new ParameterizedTypeReference<>() {});
        return extractData(resp);
    }

    public Map<String, Object> updateUserProfile(UUID userId, Map<String, Object> updates) {
        ResponseEntity<ApiResponse<Map<String, Object>>> resp = restTemplate.exchange(
                baseUrl + "/api/v1/identity/users/{userId}",
                HttpMethod.PATCH,
                new HttpEntity<>(updates),
                new ParameterizedTypeReference<>() {},
                userId);
        return extractData(resp);
    }

    public Map<String, Object> bulkCreateUsers(byte[] fileContent, String contentType) {
        org.springframework.http.HttpHeaders headers = new org.springframework.http.HttpHeaders();
        headers.setContentType(org.springframework.http.MediaType.parseMediaType(contentType));
        ResponseEntity<ApiResponse<Map<String, Object>>> resp = restTemplate.exchange(
                baseUrl + "/api/v1/identity/users/bulk",
                HttpMethod.POST,
                new HttpEntity<>(fileContent, headers),
                new ParameterizedTypeReference<>() {});
        return extractData(resp);
    }

    public byte[] exportUsers(String format) {
        return restTemplate.getForObject(
                baseUrl + "/api/v1/identity/users/export?format={format}",
                byte[].class, format);
    }

    @SuppressWarnings("unchecked")
    public List<Map<String, Object>> getAccountEntitlements(UUID accountId) {
        ResponseEntity<ApiResponse<List<Map<String, Object>>>> resp = restTemplate.exchange(
                baseUrl + "/api/v1/identity/accounts/{accountId}/entitlements",
                HttpMethod.GET, null,
                new ParameterizedTypeReference<>() {},
                accountId);
        return extractData(resp);
    }

    @SuppressWarnings("unchecked")
    public Map<String, Object> lookupByEmail(String email) {
        try {
            ResponseEntity<ApiResponse<Map<String, Object>>> resp = restTemplate.exchange(
                    baseUrl + "/api/v1/identity/users?email={email}",
                    HttpMethod.GET, null,
                    new ParameterizedTypeReference<>() {},
                    email);
            Map<String, Object> data = extractData(resp);
            if (data != null && data.containsKey("content")) {
                List<Map<String, Object>> users = (List<Map<String, Object>>) data.get("content");
                if (users != null && !users.isEmpty()) {
                    return users.getFirst();
                }
            }
            return data;
        } catch (Exception e) {
            log.debug("User lookup by email failed: {}", e.getMessage());
            return null;
        }
    }

    @SuppressWarnings("unchecked")
    public Map<String, Object> lookupByLoginId(String loginId) {
        try {
            ResponseEntity<ApiResponse<Map<String, Object>>> resp = restTemplate.exchange(
                    baseUrl + "/api/v1/identity/users?search={loginId}",
                    HttpMethod.GET, null,
                    new ParameterizedTypeReference<>() {},
                    loginId);
            Map<String, Object> data = extractData(resp);
            if (data != null && data.containsKey("content")) {
                List<Map<String, Object>> users = (List<Map<String, Object>>) data.get("content");
                if (users != null && !users.isEmpty()) {
                    return users.getFirst();
                }
            }
            return null;
        } catch (Exception e) {
            log.debug("User lookup by loginId failed: {}", e.getMessage());
            return null;
        }
    }

    public void updateUserStatus(UUID userId, String status) {
        Map<String, Object> updates = Map.of("status", status);
        restTemplate.patchForObject(
                baseUrl + "/api/v1/identity/users/{userId}",
                updates, Map.class, userId);
    }

    private <T> T extractData(ResponseEntity<ApiResponse<T>> resp) {
        if (resp.getBody() != null) {
            return resp.getBody().data();
        }
        return null;
    }
}
