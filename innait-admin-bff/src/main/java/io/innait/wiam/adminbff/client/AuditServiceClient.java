package io.innait.wiam.adminbff.client;

import io.innait.wiam.adminbff.config.BffProperties;
import io.innait.wiam.common.dto.ApiResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@Component
public class AuditServiceClient {

    private static final Logger log = LoggerFactory.getLogger(AuditServiceClient.class);

    private final RestTemplate restTemplate;
    private final String baseUrl;

    public AuditServiceClient(RestTemplate restTemplate, BffProperties props) {
        this.restTemplate = restTemplate;
        this.baseUrl = props.getAuditUrl();
    }

    @SuppressWarnings("unchecked")
    public List<Map<String, Object>> getRecentAdminActions(int limit) {
        ResponseEntity<ApiResponse<Map<String, Object>>> resp = restTemplate.exchange(
                baseUrl + "/api/v1/audit/admin-actions?size={limit}&sort=actionTime,desc",
                HttpMethod.GET, null,
                new ParameterizedTypeReference<>() {},
                limit);
        Map<String, Object> page = extractData(resp);
        if (page != null && page.containsKey("content")) {
            return (List<Map<String, Object>>) page.get("content");
        }
        return List.of();
    }

    @SuppressWarnings("unchecked")
    public List<Map<String, Object>> getUserAuditTrail(UUID userId, int limit) {
        ResponseEntity<ApiResponse<Map<String, Object>>> resp = restTemplate.exchange(
                baseUrl + "/api/v1/audit/events?actorId={userId}&size={limit}&sort=eventTime,desc",
                HttpMethod.GET, null,
                new ParameterizedTypeReference<>() {},
                userId, limit);
        Map<String, Object> page = extractData(resp);
        if (page != null && page.containsKey("content")) {
            return (List<Map<String, Object>>) page.get("content");
        }
        return List.of();
    }

    @SuppressWarnings("unchecked")
    public List<Map<String, Object>> getSecurityIncidents(String severity, int limit) {
        ResponseEntity<ApiResponse<Map<String, Object>>> resp = restTemplate.exchange(
                baseUrl + "/api/v1/audit/security-incidents?severity={severity}&size={limit}",
                HttpMethod.GET, null,
                new ParameterizedTypeReference<>() {},
                severity, limit);
        Map<String, Object> page = extractData(resp);
        if (page != null && page.containsKey("content")) {
            return (List<Map<String, Object>>) page.get("content");
        }
        return List.of();
    }

    @SuppressWarnings("unchecked")
    public Map<String, Object> getAuthStats() {
        // Query audit events with AUTHENTICATION category to compute success/fail rates
        try {
            ResponseEntity<ApiResponse<Map<String, Object>>> successResp = restTemplate.exchange(
                    baseUrl + "/api/v1/audit/events?eventCategory=AUTHENTICATION&outcome=SUCCESS&size=1",
                    HttpMethod.GET, null,
                    new ParameterizedTypeReference<>() {});
            ResponseEntity<ApiResponse<Map<String, Object>>> failureResp = restTemplate.exchange(
                    baseUrl + "/api/v1/audit/events?eventCategory=AUTHENTICATION&outcome=FAILURE&size=1",
                    HttpMethod.GET, null,
                    new ParameterizedTypeReference<>() {});

            long successCount = extractTotalFromPage(successResp);
            long failureCount = extractTotalFromPage(failureResp);
            long total = successCount + failureCount;
            double successRate = total > 0 ? (double) successCount / total * 100.0 : 0.0;

            return Map.of(
                    "successCount", successCount,
                    "failureCount", failureCount,
                    "successRate", Math.round(successRate * 100.0) / 100.0,
                    "totalAttempts", total
            );
        } catch (Exception e) {
            log.warn("Failed to get auth stats: {}", e.getMessage());
            return Map.of("successCount", 0L, "failureCount", 0L, "successRate", 0.0, "totalAttempts", 0L);
        }
    }

    @SuppressWarnings("unchecked")
    public List<Map<String, Object>> getAuditEvents(Map<String, String> params) {
        StringBuilder url = new StringBuilder(baseUrl + "/api/v1/audit/events?");
        params.forEach((k, v) -> url.append(k).append("=").append(v).append("&"));

        ResponseEntity<ApiResponse<Map<String, Object>>> resp = restTemplate.exchange(
                url.toString(), HttpMethod.GET, null,
                new ParameterizedTypeReference<>() {});
        Map<String, Object> page = extractData(resp);
        if (page != null && page.containsKey("content")) {
            return (List<Map<String, Object>>) page.get("content");
        }
        return List.of();
    }

    private long extractTotalFromPage(ResponseEntity<ApiResponse<Map<String, Object>>> resp) {
        Map<String, Object> body = extractData(resp);
        if (body != null) {
            ApiResponse<?> apiResp = resp.getBody();
            if (apiResp != null && apiResp.meta() != null) {
                return apiResp.meta().total();
            }
        }
        return 0;
    }

    private <T> T extractData(ResponseEntity<ApiResponse<T>> resp) {
        if (resp.getBody() != null) {
            return resp.getBody().data();
        }
        return null;
    }
}
