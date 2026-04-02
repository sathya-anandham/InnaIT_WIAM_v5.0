package io.innait.wiam.auditservice.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import io.innait.wiam.auditservice.entity.IncidentSeverity;
import io.innait.wiam.auditservice.entity.IncidentType;
import io.innait.wiam.auditservice.entity.SecurityIncident;
import io.innait.wiam.auditservice.repository.SecurityIncidentRepository;
import io.innait.wiam.common.event.EventEnvelope;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.HyperLogLogOperations;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class SecurityIncidentDetectorTest {

    @Mock private SecurityIncidentRepository incidentRepository;
    @Mock private StringRedisTemplate redisTemplate;
    @Mock private ValueOperations<String, String> valueOps;
    @Mock private HyperLogLogOperations<String, String> hllOps;

    private SecurityIncidentDetector detector;
    private final UUID tenantId = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        detector = new SecurityIncidentDetector(incidentRepository, redisTemplate, new ObjectMapper());
    }

    @Nested
    class BruteForce {

        @Test
        void shouldCreateIncidentWhenThresholdReached() {
            lenient().when(redisTemplate.opsForValue()).thenReturn(valueOps);
            // Simulate the 10th failure
            when(valueOps.increment(anyString())).thenReturn(10L);

            EventEnvelope<Map<String, Object>> envelope = createAuthFailedEvent("192.168.1.1");
            detector.detectBruteForce(envelope);

            ArgumentCaptor<SecurityIncident> captor = ArgumentCaptor.forClass(SecurityIncident.class);
            verify(incidentRepository).save(captor.capture());

            SecurityIncident incident = captor.getValue();
            assertThat(incident.getIncidentType()).isEqualTo(IncidentType.BRUTE_FORCE);
            assertThat(incident.getSeverity()).isEqualTo(IncidentSeverity.HIGH);
            assertThat(incident.getSourceIp()).isEqualTo("192.168.1.1");
        }

        @Test
        void shouldNotCreateIncidentBelowThreshold() {
            lenient().when(redisTemplate.opsForValue()).thenReturn(valueOps);
            when(valueOps.increment(anyString())).thenReturn(5L);

            EventEnvelope<Map<String, Object>> envelope = createAuthFailedEvent("192.168.1.1");
            detector.detectBruteForce(envelope);

            verify(incidentRepository, never()).save(any());
        }

        @Test
        void shouldSetExpiryOnFirstIncrement() {
            lenient().when(redisTemplate.opsForValue()).thenReturn(valueOps);
            when(valueOps.increment(anyString())).thenReturn(1L);

            EventEnvelope<Map<String, Object>> envelope = createAuthFailedEvent("10.0.0.1");
            detector.detectBruteForce(envelope);

            verify(redisTemplate).expire(anyString(), any(java.time.Duration.class));
        }

        @Test
        void shouldSkipWhenNoIpAddress() {
            EventEnvelope<Map<String, Object>> envelope = new EventEnvelope<>(
                    UUID.randomUUID(), "v1", "auth.failed",
                    tenantId, null, Instant.now(), null, null,
                    Map.of("account_id", UUID.randomUUID().toString()));

            detector.detectBruteForce(envelope);

            verify(redisTemplate, never()).opsForValue();
        }
    }

    @Nested
    class CredentialStuffing {

        @Test
        void shouldCreateIncidentWhenDistinctAccountsThresholdReached() {
            lenient().when(redisTemplate.opsForHyperLogLog()).thenReturn(hllOps);
            when(hllOps.add(anyString(), anyString())).thenReturn(1L);
            when(hllOps.size(anyString())).thenReturn(50L);
            lenient().when(redisTemplate.getExpire(anyString())).thenReturn(-1L);

            EventEnvelope<Map<String, Object>> envelope = createAuthFailedEvent("10.0.0.1");
            detector.detectCredentialStuffing(envelope);

            ArgumentCaptor<SecurityIncident> captor = ArgumentCaptor.forClass(SecurityIncident.class);
            verify(incidentRepository).save(captor.capture());

            SecurityIncident incident = captor.getValue();
            assertThat(incident.getIncidentType()).isEqualTo(IncidentType.CREDENTIAL_STUFFING);
            assertThat(incident.getSeverity()).isEqualTo(IncidentSeverity.CRITICAL);
        }

        @Test
        void shouldNotCreateIncidentBelowThreshold() {
            lenient().when(redisTemplate.opsForHyperLogLog()).thenReturn(hllOps);
            when(hllOps.add(anyString(), anyString())).thenReturn(1L);
            when(hllOps.size(anyString())).thenReturn(10L);
            lenient().when(redisTemplate.getExpire(anyString())).thenReturn(200L);

            EventEnvelope<Map<String, Object>> envelope = createAuthFailedEvent("10.0.0.1");
            detector.detectCredentialStuffing(envelope);

            verify(incidentRepository, never()).save(any());
        }
    }

    @Nested
    class ImpossibleTravel {

        @Test
        void shouldDetectImpossibleTravel() {
            lenient().when(redisTemplate.opsForValue()).thenReturn(valueOps);

            // Previous auth: New York (40.7128, -74.0060), 10 minutes ago
            long tenMinutesAgo = System.currentTimeMillis() - 600_000;
            when(valueOps.get(anyString())).thenReturn("40.7128,-74.0060," + tenMinutesAgo);

            // Current auth: London (51.5074, -0.1278) — ~5,570 km away in 10 min
            UUID accountId = UUID.randomUUID();
            EventEnvelope<Map<String, Object>> envelope = new EventEnvelope<>(
                    UUID.randomUUID(), "v1", "auth.succeeded",
                    tenantId, null, Instant.now(), accountId, "USER",
                    Map.of("account_id", accountId.toString(),
                            "geo_lat", 51.5074, "geo_lon", -0.1278,
                            "ip_address", "1.2.3.4"));

            detector.detectImpossibleTravel(envelope);

            ArgumentCaptor<SecurityIncident> captor = ArgumentCaptor.forClass(SecurityIncident.class);
            verify(incidentRepository).save(captor.capture());

            SecurityIncident incident = captor.getValue();
            assertThat(incident.getIncidentType()).isEqualTo(IncidentType.IMPOSSIBLE_TRAVEL);
            assertThat(incident.getSeverity()).isEqualTo(IncidentSeverity.HIGH);
            assertThat(incident.getAccountId()).isEqualTo(accountId);
        }

        @Test
        void shouldNotTriggerWhenNoPreviousGeo() {
            lenient().when(redisTemplate.opsForValue()).thenReturn(valueOps);
            when(valueOps.get(anyString())).thenReturn(null);

            UUID accountId = UUID.randomUUID();
            EventEnvelope<Map<String, Object>> envelope = new EventEnvelope<>(
                    UUID.randomUUID(), "v1", "auth.succeeded",
                    tenantId, null, Instant.now(), accountId, "USER",
                    Map.of("account_id", accountId.toString(),
                            "geo_lat", 51.5074, "geo_lon", -0.1278));

            detector.detectImpossibleTravel(envelope);

            verify(incidentRepository, never()).save(any());
        }

        @Test
        void shouldNotTriggerForNearbyLocations() {
            lenient().when(redisTemplate.opsForValue()).thenReturn(valueOps);

            // Previous: downtown Manhattan
            long fiveMinAgo = System.currentTimeMillis() - 300_000;
            when(valueOps.get(anyString())).thenReturn("40.7128,-74.0060," + fiveMinAgo);

            // Current: midtown Manhattan (~5 km away)
            UUID accountId = UUID.randomUUID();
            EventEnvelope<Map<String, Object>> envelope = new EventEnvelope<>(
                    UUID.randomUUID(), "v1", "auth.succeeded",
                    tenantId, null, Instant.now(), accountId, "USER",
                    Map.of("account_id", accountId.toString(),
                            "geo_lat", 40.7580, "geo_lon", -73.9855));

            detector.detectImpossibleTravel(envelope);

            verify(incidentRepository, never()).save(any());
        }
    }

    @Nested
    class HaversineDistance {

        @Test
        void shouldCalculateDistanceBetweenNewYorkAndLondon() {
            // NYC to London: ~5,570 km
            double distance = SecurityIncidentDetector.haversineKm(40.7128, -74.0060, 51.5074, -0.1278);
            assertThat(distance).isBetween(5500.0, 5600.0);
        }

        @Test
        void shouldReturnZeroForSamePoint() {
            double distance = SecurityIncidentDetector.haversineKm(40.7128, -74.0060, 40.7128, -74.0060);
            assertThat(distance).isLessThan(0.001);
        }

        @Test
        void shouldCalculateAntipodal() {
            // Max distance is ~20,000 km (half circumference)
            double distance = SecurityIncidentDetector.haversineKm(0, 0, 0, 180);
            assertThat(distance).isBetween(20000.0, 20100.0);
        }
    }

    // ---- Helpers ----

    private EventEnvelope<Map<String, Object>> createAuthFailedEvent(String ip) {
        return new EventEnvelope<>(
                UUID.randomUUID(), "v1", "auth.failed",
                tenantId, null, Instant.now(), null, null,
                Map.of("ip_address", ip, "account_id", UUID.randomUUID().toString()));
    }
}
