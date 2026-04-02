package io.innait.wiam.notificationservice.service;

import io.innait.wiam.notificationservice.entity.NotificationChannel;
import io.innait.wiam.notificationservice.entity.NotificationTemplate;
import io.innait.wiam.notificationservice.entity.PushProvider;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.Map;
import java.util.UUID;

@Service
public class NotificationService {

    private static final Logger log = LoggerFactory.getLogger(NotificationService.class);
    private static final int SMS_RATE_LIMIT_PER_HOUR = 5;
    private static final String SMS_RATE_KEY_PREFIX = "notif:sms:rate:";

    private final NotificationTemplateService templateService;
    private final EmailProvider emailProvider;
    private final SmsProvider smsProvider;
    private final PushNotificationProvider pushProvider;
    private final StringRedisTemplate redisTemplate;

    public NotificationService(NotificationTemplateService templateService,
                               EmailProvider emailProvider,
                               SmsProvider smsProvider,
                               PushNotificationProvider pushProvider,
                               StringRedisTemplate redisTemplate) {
        this.templateService = templateService;
        this.emailProvider = emailProvider;
        this.smsProvider = smsProvider;
        this.pushProvider = pushProvider;
        this.redisTemplate = redisTemplate;
    }

    /**
     * Send an email using a template.
     */
    public void sendEmail(UUID tenantId, String to, String templateKey, Map<String, String> variables) {
        NotificationTemplate template = templateService.resolveTemplate(templateKey, NotificationChannel.EMAIL);
        String subject = templateService.renderSubject(template, variables);
        String body = templateService.renderBody(template, variables);

        emailProvider.send(to, subject, body);
        log.info("Email notification sent: template=[{}], to=[{}]", templateKey, to);
    }

    /**
     * Send an SMS using a template with rate limiting.
     */
    public void sendSms(UUID tenantId, String to, String templateKey, Map<String, String> variables) {
        // Rate limiting: max 5 SMS per account per hour
        String accountId = variables.getOrDefault("accountId", to);
        checkSmsRateLimit(tenantId, accountId);

        NotificationTemplate template = templateService.resolveTemplate(templateKey, NotificationChannel.SMS);
        String body = templateService.renderBody(template, variables);

        smsProvider.send(to, body);
        log.info("SMS notification sent: template=[{}], to=[{}]", templateKey, maskPhone(to));
    }

    /**
     * Send a push notification.
     */
    public void sendPush(UUID tenantId, String deviceToken, PushProvider provider,
                         String title, String body, Map<String, String> data) {
        pushProvider.send(deviceToken, provider, title, body, data);
        log.info("Push notification sent: provider=[{}], title=[{}]", provider, title);
    }

    private void checkSmsRateLimit(UUID tenantId, String accountId) {
        String key = SMS_RATE_KEY_PREFIX + tenantId + ":" + accountId;
        try {
            Long count = redisTemplate.opsForValue().increment(key);
            if (count != null && count == 1L) {
                redisTemplate.expire(key, Duration.ofHours(1));
            }
            if (count != null && count > SMS_RATE_LIMIT_PER_HOUR) {
                throw new RateLimitExceededException(
                        "SMS rate limit exceeded: max " + SMS_RATE_LIMIT_PER_HOUR + " per hour for account " + accountId);
            }
        } catch (RateLimitExceededException e) {
            throw e;
        } catch (Exception e) {
            log.warn("Redis rate limit check failed, allowing SMS: {}", e.getMessage());
        }
    }

    private String maskPhone(String phone) {
        if (phone == null || phone.length() < 4) return "****";
        return "****" + phone.substring(phone.length() - 4);
    }

    public static class RateLimitExceededException extends RuntimeException {
        public RateLimitExceededException(String message) {
            super(message);
        }
    }
}
