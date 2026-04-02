package io.innait.wiam.adminbff.client;

import io.innait.wiam.adminbff.config.BffProperties;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

@Component
public class AuthServiceClient {

    private static final Logger log = LoggerFactory.getLogger(AuthServiceClient.class);

    private final RestTemplate restTemplate;
    private final String baseUrl;

    public AuthServiceClient(RestTemplate restTemplate, BffProperties props) {
        this.restTemplate = restTemplate;
        this.baseUrl = props.getAuthUrl();
    }

    // Auth orchestrator service endpoints are primarily for login flows.
    // Auth stats (success/fail rates) are derived from audit events
    // via AuditServiceClient.getAuthStats() rather than calling auth-orchestrator directly.
}
