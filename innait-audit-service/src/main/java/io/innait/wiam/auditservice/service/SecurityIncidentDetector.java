package io.innait.wiam.auditservice.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.innait.wiam.auditservice.entity.*;
import io.innait.wiam.auditservice.repository.SecurityIncidentRepository;
import io.innait.wiam.common.event.EventEnvelope;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.Map;
import java.util.UUID;

/**
 * Monitors authentication events for suspicious patterns:
 * - Brute force: > 10 failures from same IP in 5 min
 * - Credential stuffing: > 50 distinct accounts from same IP in 5 min
 * - Impossible travel: auth from 2 geos > 500km apart within 30 min
 */
@Service
public class SecurityIncidentDetector {

    private static final Logger log = LoggerFactory.getLogger(SecurityIncidentDetector.class);

    private static final int BRUTE_FORCE_THRESHOLD = 10;
    private static final int CREDENTIAL_STUFFING_THRESHOLD = 50;
    private static final double IMPOSSIBLE_TRAVEL_DISTANCE_KM = 500.0;
    private static final Duration BRUTE_FORCE_WINDOW = Duration.ofMinutes(5);
    private static final Duration CREDENTIAL_STUFFING_WINDOW = Duration.ofMinutes(5);

    private static final String BRUTE_FORCE_KEY_PREFIX = "audit:bf:";
    private static final String CRED_STUFF_KEY_PREFIX = "audit:cs:";
    private static final String LAST_AUTH_GEO_PREFIX = "audit:geo:";

    private final SecurityIncidentRepository incidentRepository;
    private final StringRedisTemplate redisTemplate;
    private final ObjectMapper objectMapper;

    public SecurityIncidentDetector(SecurityIncidentRepository incidentRepository,
                                    StringRedisTemplate redisTemplate,
                                    ObjectMapper objectMapper) {
        this.incidentRepository = incidentRepository;
        this.redisTemplate = redisTemplate;
        this.objectMapper = objectMapper;
    }

    /**
     * Analyze an event for security patterns. Called for every consumed event.
     */
    public void analyze(EventEnvelope<?> envelope, String topic) {
        if (envelope.eventType() == null) return;

        String eventType = envelope.eventType().toLowerCase();

        // Only analyze auth-related events
        if (eventType.contains("auth.failed") || eventType.contains("authn.failed")) {
            detectBruteForce(envelope);
            detectCredentialStuffing(envelope);
        }

        if (eventType.contains("auth.succeeded") || eventType.contains("authn.succeeded")) {
            detectImpossibleTravel(envelope);
        }
    }

    /**
     * Brute force: > 10 failures from same IP in 5 minutes.
     */
    void detectBruteForce(EventEnvelope<?> envelope) {
        String ip = extractIp(envelope);
        if (ip == null) return;

        String key = BRUTE_FORCE_KEY_PREFIX + envelope.tenantId() + ":" + ip;
        try {
            Long count = redisTemplate.opsForValue().increment(key);
            if (count != null && count == 1L) {
                redisTemplate.expire(key, BRUTE_FORCE_WINDOW);
            }

            if (count != null && count == BRUTE_FORCE_THRESHOLD) {
                createIncident(
                        envelope.tenantId(),
                        IncidentType.BRUTE_FORCE,
                        IncidentSeverity.HIGH,
                        ip,
                        extractAccountId(envelope),
                        String.format("Brute force detected: %d failed auth attempts from IP %s in 5 minutes", count, ip),
                        serializeDetail(Map.of("ip", ip, "failureCount", count, "window", "5m"))
                );
                log.warn("SECURITY INCIDENT: Brute force detected from IP {} ({} failures)", ip, count);
            }
        } catch (Exception e) {
            log.error("Error detecting brute force: {}", e.getMessage());
        }
    }

    /**
     * Credential stuffing: > 50 distinct accounts targeted from same IP.
     */
    void detectCredentialStuffing(EventEnvelope<?> envelope) {
        String ip = extractIp(envelope);
        UUID accountId = extractAccountId(envelope);
        if (ip == null || accountId == null) return;

        String key = CRED_STUFF_KEY_PREFIX + envelope.tenantId() + ":" + ip;
        try {
            Long count = redisTemplate.opsForHyperLogLog().add(key, accountId.toString());
            // Set expiry on first addition
            if (redisTemplate.getExpire(key) == null || redisTemplate.getExpire(key) < 0) {
                redisTemplate.expire(key, CREDENTIAL_STUFFING_WINDOW);
            }

            Long distinctAccounts = redisTemplate.opsForHyperLogLog().size(key);
            if (distinctAccounts != null && distinctAccounts == CREDENTIAL_STUFFING_THRESHOLD) {
                createIncident(
                        envelope.tenantId(),
                        IncidentType.CREDENTIAL_STUFFING,
                        IncidentSeverity.CRITICAL,
                        ip,
                        null,
                        String.format("Credential stuffing detected: %d distinct accounts targeted from IP %s", distinctAccounts, ip),
                        serializeDetail(Map.of("ip", ip, "distinctAccounts", distinctAccounts, "window", "5m"))
                );
                log.warn("SECURITY INCIDENT: Credential stuffing detected from IP {} ({} accounts)", ip, distinctAccounts);
            }
        } catch (Exception e) {
            log.error("Error detecting credential stuffing: {}", e.getMessage());
        }
    }

    /**
     * Impossible travel: auth from 2 geos > 500km apart within 30 min.
     */
    void detectImpossibleTravel(EventEnvelope<?> envelope) {
        UUID accountId = extractAccountId(envelope);
        Double lat = extractDouble(envelope, "geo_lat");
        Double lon = extractDouble(envelope, "geo_lon");
        if (accountId == null || lat == null || lon == null) return;

        String key = LAST_AUTH_GEO_PREFIX + envelope.tenantId() + ":" + accountId;
        try {
            String previousGeo = redisTemplate.opsForValue().get(key);
            String currentGeo = lat + "," + lon + "," + System.currentTimeMillis();
            redisTemplate.opsForValue().set(key, currentGeo, Duration.ofMinutes(30));

            if (previousGeo != null) {
                String[] parts = previousGeo.split(",");
                if (parts.length == 3) {
                    double prevLat = Double.parseDouble(parts[0]);
                    double prevLon = Double.parseDouble(parts[1]);
                    long prevTimeMs = Long.parseLong(parts[2]);

                    double distance = haversineKm(prevLat, prevLon, lat, lon);
                    long elapsedMinutes = (System.currentTimeMillis() - prevTimeMs) / 60_000;

                    if (distance > IMPOSSIBLE_TRAVEL_DISTANCE_KM && elapsedMinutes <= 30) {
                        createIncident(
                                envelope.tenantId(),
                                IncidentType.IMPOSSIBLE_TRAVEL,
                                IncidentSeverity.HIGH,
                                extractIp(envelope),
                                accountId,
                                String.format("Impossible travel detected: %.0fkm in %d minutes for account %s",
                                        distance, elapsedMinutes, accountId),
                                serializeDetail(Map.of(
                                        "accountId", accountId.toString(),
                                        "previousLat", prevLat, "previousLon", prevLon,
                                        "currentLat", lat, "currentLon", lon,
                                        "distanceKm", distance, "elapsedMinutes", elapsedMinutes
                                ))
                        );
                        log.warn("SECURITY INCIDENT: Impossible travel for account {} ({:.0f}km in {}min)",
                                accountId, distance, elapsedMinutes);
                    }
                }
            }
        } catch (Exception e) {
            log.error("Error detecting impossible travel: {}", e.getMessage());
        }
    }

    private void createIncident(UUID tenantId, IncidentType type, IncidentSeverity severity,
                                String sourceIp, UUID accountId, String description, String detail) {
        SecurityIncident incident = new SecurityIncident(
                UUID.randomUUID(), tenantId, type, severity,
                sourceIp, accountId, description, detail,
                IncidentStatus.OPEN, java.time.Instant.now()
        );
        incidentRepository.save(incident);
    }

    /**
     * Haversine formula for great-circle distance between two points.
     */
    static double haversineKm(double lat1, double lon1, double lat2, double lon2) {
        double R = 6371.0; // Earth radius in km
        double dLat = Math.toRadians(lat2 - lat1);
        double dLon = Math.toRadians(lon2 - lon1);
        double a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
                + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2))
                * Math.sin(dLon / 2) * Math.sin(dLon / 2);
        double c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    @SuppressWarnings("unchecked")
    private String extractIp(EventEnvelope<?> envelope) {
        if (envelope.payload() instanceof Map<?, ?> map) {
            Object ip = map.get("ip_address");
            if (ip == null) ip = map.get("source_ip");
            return ip != null ? ip.toString() : null;
        }
        return null;
    }

    @SuppressWarnings("unchecked")
    private UUID extractAccountId(EventEnvelope<?> envelope) {
        if (envelope.payload() instanceof Map<?, ?> map) {
            Object id = map.get("account_id");
            if (id != null) {
                try {
                    return UUID.fromString(id.toString());
                } catch (IllegalArgumentException e) {
                    return null;
                }
            }
        }
        return envelope.actorId();
    }

    @SuppressWarnings("unchecked")
    private Double extractDouble(EventEnvelope<?> envelope, String key) {
        if (envelope.payload() instanceof Map<?, ?> map) {
            Object val = map.get(key);
            if (val instanceof Number n) return n.doubleValue();
            if (val != null) {
                try {
                    return Double.parseDouble(val.toString());
                } catch (NumberFormatException e) {
                    return null;
                }
            }
        }
        return null;
    }

    private String serializeDetail(Map<String, Object> detail) {
        try {
            return objectMapper.writeValueAsString(detail);
        } catch (JsonProcessingException e) {
            return "{}";
        }
    }
}
