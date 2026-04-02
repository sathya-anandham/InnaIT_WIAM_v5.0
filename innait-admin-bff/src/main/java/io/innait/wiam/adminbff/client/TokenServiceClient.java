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
public class TokenServiceClient {

    private static final Logger log = LoggerFactory.getLogger(TokenServiceClient.class);

    private final RestTemplate restTemplate;
    private final String baseUrl;

    public TokenServiceClient(RestTemplate restTemplate, BffProperties props) {
        this.restTemplate = restTemplate;
        this.baseUrl = props.getTokenUrl();
    }

    public Map<String, Object> issueToken(UUID sessionId, UUID accountId, UUID tenantId,
                                           String loginId, List<String> roles,
                                           List<String> amr, String acr) {
        Map<String, Object> request = Map.of(
                "sessionId", sessionId.toString(),
                "accountId", accountId.toString(),
                "tenantId", tenantId.toString(),
                "loginId", loginId,
                "roles", roles,
                "groups", List.of(),
                "amr", amr,
                "acr", acr
        );
        ResponseEntity<ApiResponse<Map<String, Object>>> resp = restTemplate.exchange(
                baseUrl + "/api/v1/tokens/issue",
                HttpMethod.POST,
                new HttpEntity<>(request),
                new ParameterizedTypeReference<>() {});
        return extractData(resp);
    }

    public void revokeToken(String jti) {
        try {
            Map<String, String> request = Map.of("jti", jti);
            restTemplate.postForEntity(
                    baseUrl + "/api/v1/tokens/revoke",
                    request, ApiResponse.class);
        } catch (Exception e) {
            log.warn("Failed to revoke token [{}]: {}", jti, e.getMessage());
        }
    }

    private <T> T extractData(ResponseEntity<ApiResponse<T>> resp) {
        if (resp.getBody() != null) {
            return resp.getBody().data();
        }
        return null;
    }
}
