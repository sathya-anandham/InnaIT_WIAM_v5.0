package io.innait.wiam.adminbff.websocket;

import io.innait.wiam.adminbff.dto.AdminNotification;
import io.innait.wiam.common.kafka.InnaITTopics;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.Map;

@Component
public class AdminNotificationHandler {

    private static final Logger log = LoggerFactory.getLogger(AdminNotificationHandler.class);
    private static final String ADMIN_TOPIC = "/topic/admin/notifications";

    private final SimpMessagingTemplate messagingTemplate;

    public AdminNotificationHandler(SimpMessagingTemplate messagingTemplate) {
        this.messagingTemplate = messagingTemplate;
    }

    @KafkaListener(topics = InnaITTopics.SECURITY_INCIDENT_DETECTED,
            groupId = "admin-bff-notifications",
            autoStartup = "${wiam.kafka.enabled:false}")
    public void onSecurityIncident(Map<String, Object> event) {
        log.info("Security incident received, pushing to WebSocket");
        AdminNotification notification = new AdminNotification(
                "SECURITY_INCIDENT",
                String.valueOf(event.getOrDefault("severity", "MEDIUM")),
                "Security Incident Detected",
                String.valueOf(event.getOrDefault("description", "A security incident was detected")),
                Instant.now()
        );
        messagingTemplate.convertAndSend(ADMIN_TOPIC, notification);
    }

    @KafkaListener(topics = InnaITTopics.ACCOUNT_LOCKED,
            groupId = "admin-bff-notifications",
            autoStartup = "${wiam.kafka.enabled:false}")
    public void onAccountLocked(Map<String, Object> event) {
        log.info("Account lockout received, pushing to WebSocket");
        AdminNotification notification = new AdminNotification(
                "ACCOUNT_LOCKOUT",
                "HIGH",
                "Account Locked",
                "Account " + event.getOrDefault("loginId", "unknown") + " has been locked",
                Instant.now()
        );
        messagingTemplate.convertAndSend(ADMIN_TOPIC, notification);
    }

    public void pushNotification(AdminNotification notification) {
        messagingTemplate.convertAndSend(ADMIN_TOPIC, notification);
    }
}
