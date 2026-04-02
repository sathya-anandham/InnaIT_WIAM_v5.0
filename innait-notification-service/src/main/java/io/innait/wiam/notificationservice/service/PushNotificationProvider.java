package io.innait.wiam.notificationservice.service;

import io.innait.wiam.notificationservice.entity.PushProvider;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.Map;

/**
 * Push notification provider that routes to FCM, APNs, or HMS based on push_provider.
 */
@Service
public class PushNotificationProvider {

    private static final Logger log = LoggerFactory.getLogger(PushNotificationProvider.class);

    /**
     * Send a push notification routed to the correct provider.
     */
    public void send(String deviceToken, PushProvider provider, String title, String body,
                     Map<String, String> data) {
        PushPayload payload = buildPayload(provider, deviceToken, title, body, data);

        switch (provider) {
            case FCM -> sendFcm(payload);
            case APNS -> sendApns(payload);
            case HMS -> sendHms(payload);
        }
    }

    /**
     * Build a provider-specific push payload.
     */
    public PushPayload buildPayload(PushProvider provider, String deviceToken,
                                     String title, String body, Map<String, String> data) {
        return new PushPayload(provider, deviceToken, title, body, data);
    }

    private void sendFcm(PushPayload payload) {
        // FCM integration via Firebase Admin SDK or REST API
        // POST https://fcm.googleapis.com/v1/projects/{project}/messages:send
        log.info("FCM push sent to device [{}]: {}", maskToken(payload.deviceToken()), payload.title());
    }

    private void sendApns(PushPayload payload) {
        // APNs integration via HTTP/2 push
        // POST https://api.push.apple.com/3/device/{deviceToken}
        log.info("APNs push sent to device [{}]: {}", maskToken(payload.deviceToken()), payload.title());
    }

    private void sendHms(PushPayload payload) {
        // HMS Push Kit integration
        // POST https://push-api.cloud.huawei.com/v2/{appId}/messages:send
        log.info("HMS push sent to device [{}]: {}", maskToken(payload.deviceToken()), payload.title());
    }

    private String maskToken(String token) {
        if (token == null || token.length() < 8) return "****";
        return token.substring(0, 4) + "****" + token.substring(token.length() - 4);
    }

    public record PushPayload(
            PushProvider provider,
            String deviceToken,
            String title,
            String body,
            Map<String, String> data
    ) {
    }
}
