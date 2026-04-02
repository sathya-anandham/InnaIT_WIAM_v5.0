package io.innait.wiam.notificationservice.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.Map;

@Service
public class SmsProvider {

    private static final Logger log = LoggerFactory.getLogger(SmsProvider.class);
    private static final int MAX_SMS_LENGTH = 160;

    @Value("${innait.notification.sms.gateway-url:http://localhost:9999/sms/send}")
    private String gatewayUrl;

    @Value("${innait.notification.sms.api-key:}")
    private String apiKey;

    private final RestTemplate restTemplate;

    public SmsProvider() {
        this.restTemplate = new RestTemplate();
    }

    // Visible for testing
    SmsProvider(RestTemplate restTemplate) {
        this.restTemplate = restTemplate;
    }

    /**
     * Send an SMS message via the configured gateway.
     */
    public void send(String phoneNumber, String message) {
        String formattedMessage = formatMessage(message);

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        if (apiKey != null && !apiKey.isBlank()) {
            headers.set("X-API-Key", apiKey);
        }

        Map<String, String> body = Map.of(
                "to", phoneNumber,
                "message", formattedMessage
        );

        try {
            restTemplate.postForEntity(gatewayUrl, new HttpEntity<>(body, headers), String.class);
            log.info("SMS sent to [{}] ({} chars)", maskPhone(phoneNumber), formattedMessage.length());
        } catch (Exception e) {
            log.error("Failed to send SMS to [{}]: {}", maskPhone(phoneNumber), e.getMessage(), e);
            throw new RuntimeException("SMS sending failed", e);
        }
    }

    /**
     * Format SMS message: truncate to 160 chars if needed.
     */
    public String formatMessage(String message) {
        if (message == null) return "";
        if (message.length() <= MAX_SMS_LENGTH) return message;
        return message.substring(0, MAX_SMS_LENGTH - 3) + "...";
    }

    private String maskPhone(String phone) {
        if (phone == null || phone.length() < 4) return "****";
        return "****" + phone.substring(phone.length() - 4);
    }
}
