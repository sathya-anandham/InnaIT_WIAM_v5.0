package io.innait.wiam.auditservice.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import io.innait.wiam.auditservice.entity.AuditEvent;
import io.innait.wiam.auditservice.entity.AuditOutcome;
import io.innait.wiam.auditservice.entity.EventCategory;
import io.innait.wiam.common.event.EventEnvelope;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class AuditEventMapperTest {

    private AuditEventMapper mapper;

    @BeforeEach
    void setUp() {
        mapper = new AuditEventMapper(new ObjectMapper());
    }

    @Nested
    class CategoryDerivation {

        @ParameterizedTest
        @CsvSource({
                "innait.authn.started, AUTHENTICATION",
                "innait.authn.succeeded, AUTHENTICATION",
                "innait.authn.failed, AUTHENTICATION",
                "innait.credential.enrolled, CREDENTIAL",
                "innait.credential.revoked, CREDENTIAL",
                "innait.identity.user.created, USER_MANAGEMENT",
                "innait.identity.user.updated, USER_MANAGEMENT",
                "innait.identity.account.status.changed, USER_MANAGEMENT",
                "innait.session.created, SESSION",
                "innait.session.revoked, SESSION",
                "innait.policy.updated, POLICY",
                "innait.admin.action.logged, CONFIG",
                "innait.connector.sync.completed, DIRECTORY_SYNC",
                "innait.security.incident, SECURITY"
        })
        void shouldDeriveCategoryFromTopic(String topic, EventCategory expected) {
            assertThat(mapper.deriveCategory(topic)).isEqualTo(expected);
        }

        @Test
        void shouldReturnSystemForUnknownTopic() {
            assertThat(mapper.deriveCategory("unknown.topic")).isEqualTo(EventCategory.SYSTEM);
        }

        @Test
        void shouldReturnSystemForNullTopic() {
            assertThat(mapper.deriveCategory(null)).isEqualTo(EventCategory.SYSTEM);
        }
    }

    @Nested
    class ActionDerivation {

        @ParameterizedTest
        @CsvSource({
                "user.created, CREATE",
                "user.updated, UPDATE",
                "account.status.changed, UPDATE",
                "account.terminated, DELETE",
                "credential.revoked, DELETE",
                "account.role.assigned, ASSIGN",
                "account.role.removed, REMOVE",
                "credential.enrolled, ENROLL",
                "auth.started, INITIATE",
                "auth.succeeded, COMPLETE",
                "auth.failed, FAIL",
                "admin.action.logged, LOG"
        })
        void shouldDeriveActionFromEventType(String eventType, String expectedAction) {
            assertThat(mapper.deriveAction(eventType)).isEqualTo(expectedAction);
        }

        @Test
        void shouldReturnOtherForUnrecognizedType() {
            assertThat(mapper.deriveAction("some.random.event")).isEqualTo("OTHER");
        }

        @Test
        void shouldReturnUnknownForNull() {
            assertThat(mapper.deriveAction(null)).isEqualTo("UNKNOWN");
        }
    }

    @Nested
    class OutcomeDerivation {

        @Test
        void shouldReturnFailureForAuthFailed() {
            assertThat(mapper.deriveOutcome("auth.failed")).isEqualTo(AuditOutcome.FAILURE);
        }

        @Test
        void shouldReturnFailureForDenied() {
            assertThat(mapper.deriveOutcome("access.denied")).isEqualTo(AuditOutcome.FAILURE);
        }

        @Test
        void shouldReturnErrorForErrorEvents() {
            assertThat(mapper.deriveOutcome("sync.error")).isEqualTo(AuditOutcome.ERROR);
        }

        @Test
        void shouldReturnSuccessForNormalEvents() {
            assertThat(mapper.deriveOutcome("user.created")).isEqualTo(AuditOutcome.SUCCESS);
        }

        @Test
        void shouldReturnSuccessForNull() {
            assertThat(mapper.deriveOutcome(null)).isEqualTo(AuditOutcome.SUCCESS);
        }
    }

    @Nested
    class ServiceNameDerivation {

        @Test
        void shouldDeriveServiceNameFromTopic() {
            assertThat(mapper.deriveServiceName("innait.identity.user.created")).isEqualTo("identity");
            assertThat(mapper.deriveServiceName("innait.authn.succeeded")).isEqualTo("authn");
            assertThat(mapper.deriveServiceName("innait.credential.enrolled")).isEqualTo("credential");
        }

        @Test
        void shouldReturnUnknownForShortTopic() {
            assertThat(mapper.deriveServiceName("innait")).isEqualTo("unknown");
        }
    }

    @Nested
    class FullMapping {

        @Test
        void shouldMapEventEnvelopeToAuditEvent() {
            UUID tenantId = UUID.randomUUID();
            UUID actorId = UUID.randomUUID();
            UUID correlationId = UUID.randomUUID();
            Instant now = Instant.now();

            EventEnvelope<Map<String, Object>> envelope = new EventEnvelope<>(
                    UUID.randomUUID(), "v1", "user.created",
                    tenantId, correlationId, now, actorId, "USER", null,
                    Map.of("ip_address", "10.0.0.1", "subject_id", UUID.randomUUID().toString()));

            AuditEvent result = mapper.mapToAuditEvent(envelope, "innait.identity.user.created");

            assertThat(result.getAuditEventId()).isNotNull();
            assertThat(result.getTenantId()).isEqualTo(tenantId);
            assertThat(result.getCorrelationId()).isEqualTo(correlationId);
            assertThat(result.getEventType()).isEqualTo("user.created");
            assertThat(result.getEventCategory()).isEqualTo(EventCategory.USER_MANAGEMENT);
            assertThat(result.getActorId()).isEqualTo(actorId);
            assertThat(result.getActorType()).isEqualTo("USER");
            assertThat(result.getActorIp()).isEqualTo("10.0.0.1");
            assertThat(result.getAction()).isEqualTo("CREATE");
            assertThat(result.getOutcome()).isEqualTo(AuditOutcome.SUCCESS);
            assertThat(result.getServiceName()).isEqualTo("identity");
            assertThat(result.getEventTime()).isEqualTo(now);
            assertThat(result.getDetail()).isNotNull();
        }

        @Test
        void shouldHandleNullPayload() {
            EventEnvelope<Object> envelope = new EventEnvelope<>(
                    UUID.randomUUID(), "v1", "user.created",
                    UUID.randomUUID(), null, Instant.now(), null, null, null, null);

            AuditEvent result = mapper.mapToAuditEvent(envelope, "innait.identity.user.created");

            assertThat(result.getActorIp()).isNull();
            assertThat(result.getSubjectId()).isNull();
        }
    }
}
