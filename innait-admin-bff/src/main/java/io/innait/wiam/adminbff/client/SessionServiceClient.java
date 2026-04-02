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
public class SessionServiceClient {

    private static final Logger log = LoggerFactory.getLogger(SessionServiceClient.class);

    private final RestTemplate restTemplate;
    private final String baseUrl;

    public SessionServiceClient(RestTemplate restTemplate, BffProperties props) {
        this.restTemplate = restTemplate;
        this.baseUrl = props.getSessionUrl();
    }

    @SuppressWarnings("unchecked")
    public List<Map<String, Object>> getAccountSessions(UUID accountId) {
        ResponseEntity<ApiResponse<List<Map<String, Object>>>> resp = restTemplate.exchange(
                baseUrl + "/api/v1/sessions/account/{accountId}",
                HttpMethod.GET, null,
                new ParameterizedTypeReference<>() {},
                accountId);
        return extractData(resp);
    }

    public long getActiveSessionCount() {
        try {
            ResponseEntity<ApiResponse<Map<String, Object>>> resp = restTemplate.exchange(
                    baseUrl + "/api/v1/sessions/count?status=ACTIVE",
                    HttpMethod.GET, null,
                    new ParameterizedTypeReference<>() {});
            Map<String, Object> data = extractData(resp);
            if (data != null && data.containsKey("count")) {
                return ((Number) data.get("count")).longValue();
            }
        } catch (Exception e) {
            log.warn("Failed to get active session count: {}", e.getMessage());
        }
        return 0;
    }

    public void revokeSession(UUID sessionId) {
        restTemplate.delete(baseUrl + "/api/v1/sessions/{sessionId}", sessionId);
    }

    public Map<String, Object> createSession(Map<String, Object> request) {
        ResponseEntity<ApiResponse<Map<String, Object>>> resp = restTemplate.exchange(
                baseUrl + "/api/v1/sessions",
                HttpMethod.POST,
                new HttpEntity<>(request),
                new ParameterizedTypeReference<>() {});
        return extractData(resp);
    }

    public void revokeAllAccountSessions(UUID accountId) {
        List<Map<String, Object>> sessions = getAccountSessions(accountId);
        if (sessions != null) {
            for (Map<String, Object> session : sessions) {
                Object sid = session.get("sessionId");
                if (sid != null) {
                    try {
                        revokeSession(UUID.fromString(sid.toString()));
                    } catch (Exception e) {
                        log.debug("Failed to revoke session [{}]: {}", sid, e.getMessage());
                    }
                }
            }
        }
    }

    private <T> T extractData(ResponseEntity<ApiResponse<T>> resp) {
        if (resp.getBody() != null) {
            return resp.getBody().data();
        }
        return null;
    }
}
