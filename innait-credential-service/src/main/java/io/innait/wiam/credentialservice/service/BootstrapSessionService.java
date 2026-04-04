package io.innait.wiam.credentialservice.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.innait.wiam.common.context.CorrelationContext;
import io.innait.wiam.common.event.EventEnvelope;
import io.innait.wiam.common.kafka.EventPublisher;
import io.innait.wiam.common.kafka.InnaITTopics;
import io.innait.wiam.common.redis.RedisCacheKeys;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.TimeUnit;

@Service
public class BootstrapSessionService {

    private static final Logger log = LoggerFactory.getLogger(BootstrapSessionService.class);

    private final StringRedisTemplate redisTemplate;
    private final ObjectMapper objectMapper;
    private final EventPublisher eventPublisher;

    public BootstrapSessionService(StringRedisTemplate redisTemplate,
                                    ObjectMapper objectMapper,
                                    EventPublisher eventPublisher) {
        this.redisTemplate = redisTemplate;
        this.objectMapper = objectMapper;
        this.eventPublisher = eventPublisher;
    }

    public UUID createRestrictedBootstrapSession(UUID accountId, UUID tenantId, UUID userId) {
        UUID sessionId = UUID.randomUUID();

        Map<String, String> sessionData = new LinkedHashMap<>();
        sessionData.put("sessionId", sessionId.toString());
        sessionData.put("accountId", accountId.toString());
        sessionData.put("tenantId", tenantId.toString());
        sessionData.put("userId", userId.toString());
        sessionData.put("type", "BOOTSTRAP");
        sessionData.put("restricted", "true");

        try {
            String json = objectMapper.writeValueAsString(sessionData);
            String key = RedisCacheKeys.bootstrapSessionKey(sessionId);
            redisTemplate.opsForValue().set(key, json, RedisCacheKeys.BOOTSTRAP_SESSION_TTL, TimeUnit.SECONDS);

            publishBootstrapSessionEvent(sessionId, accountId, tenantId);
            log.info("Bootstrap session created [{}] for account [{}]", sessionId, accountId);
            return sessionId;
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Failed to serialize bootstrap session data", e);
        }
    }

    public Map<String, String> validateBootstrapSessionForOnboarding(UUID sessionId) {
        String key = RedisCacheKeys.bootstrapSessionKey(sessionId);
        String json = redisTemplate.opsForValue().get(key);

        if (json == null) {
            throw new IllegalStateException("Bootstrap session not found or expired: " + sessionId);
        }

        try {
            @SuppressWarnings("unchecked")
            Map<String, String> sessionData = objectMapper.readValue(json, Map.class);

            if (!"BOOTSTRAP".equals(sessionData.get("type"))) {
                throw new IllegalStateException("Invalid session type for bootstrap: " + sessionId);
            }

            if (!"true".equals(sessionData.get("restricted"))) {
                throw new IllegalStateException("Session is not a restricted bootstrap session: " + sessionId);
            }

            log.debug("Bootstrap session validated [{}]", sessionId);
            return sessionData;
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Failed to parse bootstrap session data", e);
        }
    }

    public void expireBootstrapSessionAfterFidoActivation(UUID sessionId) {
        String key = RedisCacheKeys.bootstrapSessionKey(sessionId);
        redisTemplate.delete(key);
        log.info("Bootstrap session expired [{}] after FIDO activation", sessionId);
    }

    private void publishBootstrapSessionEvent(UUID sessionId, UUID accountId, UUID tenantId) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("sessionId", sessionId.toString());
        payload.put("accountId", accountId.toString());

        EventEnvelope<Map<String, Object>> event = EventEnvelope.<Map<String, Object>>builder()
                .eventType("auth.bootstrap.session.created")
                .tenantId(tenantId)
                .correlationId(CorrelationContext.getCorrelationId())
                .payload(payload)
                .build();

        eventPublisher.publish(InnaITTopics.BOOTSTRAP_SESSION_CREATED, event);
    }
}
