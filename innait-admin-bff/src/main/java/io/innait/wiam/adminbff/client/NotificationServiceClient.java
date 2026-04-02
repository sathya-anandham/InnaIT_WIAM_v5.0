package io.innait.wiam.adminbff.client;

import io.innait.wiam.adminbff.config.BffProperties;
import io.innait.wiam.common.dto.ApiResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

import java.util.Map;
import java.util.UUID;

@Component
public class NotificationServiceClient {

    private static final Logger log = LoggerFactory.getLogger(NotificationServiceClient.class);

    private final RestTemplate restTemplate;
    private final String baseUrl;

    public NotificationServiceClient(RestTemplate restTemplate, BffProperties props) {
        this.restTemplate = restTemplate;
        this.baseUrl = props.getNotificationUrl();
    }

    public void sendEmail(UUID tenantId, String to, String templateKey, Map<String, String> variables) {
        try {
            Map<String, Object> request = Map.of(
                    "tenantId", tenantId.toString(),
                    "to", to,
                    "templateKey", templateKey,
                    "channel", "EMAIL",
                    "variables", variables
            );
            restTemplate.postForEntity(
                    baseUrl + "/api/v1/notifications/send",
                    request, ApiResponse.class);
        } catch (Exception e) {
            log.warn("Failed to send email notification to [{}]: {}", to, e.getMessage());
        }
    }

    public void sendSms(UUID tenantId, String to, String templateKey, Map<String, String> variables) {
        try {
            Map<String, Object> request = Map.of(
                    "tenantId", tenantId.toString(),
                    "to", to,
                    "templateKey", templateKey,
                    "channel", "SMS",
                    "variables", variables
            );
            restTemplate.postForEntity(
                    baseUrl + "/api/v1/notifications/send",
                    request, ApiResponse.class);
        } catch (Exception e) {
            log.warn("Failed to send SMS notification to [{}]: {}", maskPhone(to), e.getMessage());
        }
    }

    private String maskPhone(String phone) {
        if (phone == null || phone.length() < 4) return "****";
        return "****" + phone.substring(phone.length() - 4);
    }
}
