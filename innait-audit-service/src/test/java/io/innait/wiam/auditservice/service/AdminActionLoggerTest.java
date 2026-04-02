package io.innait.wiam.auditservice.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.innait.wiam.auditservice.dto.AdminActionRequest;
import io.innait.wiam.auditservice.dto.AdminActionResponse;
import io.innait.wiam.auditservice.entity.AdminAction;
import io.innait.wiam.auditservice.repository.AdminActionRepository;
import io.innait.wiam.common.context.TenantContext;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AdminActionLoggerTest {

    @Mock private AdminActionRepository repository;
    private AdminActionLogger logger;
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final UUID tenantId = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        logger = new AdminActionLogger(repository, objectMapper);
        TenantContext.setTenantId(tenantId);
    }

    @AfterEach
    void tearDown() {
        TenantContext.clear();
    }

    @Nested
    class JsonDiff {

        @Test
        void shouldDetectAddedFields() throws Exception {
            Map<String, Object> before = Map.of("name", "Alice");
            Map<String, Object> after = Map.of("name", "Alice", "email", "alice@test.com");

            String diff = logger.computeDiff(before, after);
            JsonNode diffNode = objectMapper.readTree(diff);

            assertThat(diffNode.has("email")).isTrue();
            assertThat(diffNode.get("email").get("old").isNull()).isTrue();
            assertThat(diffNode.get("email").get("new").asText()).isEqualTo("alice@test.com");
            assertThat(diffNode.has("name")).isFalse(); // unchanged
        }

        @Test
        void shouldDetectRemovedFields() throws Exception {
            Map<String, Object> before = Map.of("name", "Alice", "email", "alice@test.com");
            Map<String, Object> after = Map.of("name", "Alice");

            String diff = logger.computeDiff(before, after);
            JsonNode diffNode = objectMapper.readTree(diff);

            assertThat(diffNode.has("email")).isTrue();
            assertThat(diffNode.get("email").get("old").asText()).isEqualTo("alice@test.com");
            assertThat(diffNode.get("email").get("new").isNull()).isTrue();
        }

        @Test
        void shouldDetectChangedFields() throws Exception {
            Map<String, Object> before = Map.of("name", "Alice", "role", "USER");
            Map<String, Object> after = Map.of("name", "Alice", "role", "ADMIN");

            String diff = logger.computeDiff(before, after);
            JsonNode diffNode = objectMapper.readTree(diff);

            assertThat(diffNode.has("role")).isTrue();
            assertThat(diffNode.get("role").get("old").asText()).isEqualTo("USER");
            assertThat(diffNode.get("role").get("new").asText()).isEqualTo("ADMIN");
            assertThat(diffNode.has("name")).isFalse();
        }

        @Test
        void shouldReturnEmptyDiffForIdenticalObjects() throws Exception {
            Map<String, Object> data = Map.of("name", "Alice", "role", "USER");

            String diff = logger.computeDiff(data, data);
            JsonNode diffNode = objectMapper.readTree(diff);

            assertThat(diffNode.isEmpty()).isTrue();
        }

        @Test
        void shouldHandleNullBefore() throws Exception {
            Map<String, Object> after = Map.of("name", "Alice");

            String diff = logger.computeDiff(null, after);
            JsonNode diffNode = objectMapper.readTree(diff);

            assertThat(diffNode.has("name")).isTrue();
        }

        @Test
        void shouldHandleNullAfter() throws Exception {
            Map<String, Object> before = Map.of("name", "Alice");

            String diff = logger.computeDiff(before, null);
            JsonNode diffNode = objectMapper.readTree(diff);

            assertThat(diffNode.has("name")).isTrue();
            assertThat(diffNode.get("name").get("old").asText()).isEqualTo("Alice");
            assertThat(diffNode.get("name").get("new").isNull()).isTrue();
        }
    }

    @Nested
    class LogAction {

        @Test
        void shouldPersistAdminAction() {
            when(repository.save(any(AdminAction.class))).thenAnswer(inv -> inv.getArgument(0));

            UUID adminId = UUID.randomUUID();
            UUID targetId = UUID.randomUUID();
            AdminActionRequest request = new AdminActionRequest(
                    adminId, "UPDATE", "USER", targetId,
                    Map.of("status", "ACTIVE"), Map.of("status", "SUSPENDED"),
                    "Suspicious behavior");

            AdminActionResponse response = logger.logAction(request);

            assertThat(response.adminId()).isEqualTo(adminId);
            assertThat(response.actionType()).isEqualTo("UPDATE");
            assertThat(response.targetType()).isEqualTo("USER");
            assertThat(response.targetId()).isEqualTo(targetId);
            assertThat(response.justification()).isEqualTo("Suspicious behavior");
            assertThat(response.actionTime()).isNotNull();

            ArgumentCaptor<AdminAction> captor = ArgumentCaptor.forClass(AdminAction.class);
            verify(repository).save(captor.capture());
            assertThat(captor.getValue().getTenantId()).isEqualTo(tenantId);
        }

        @Test
        void shouldSerializeBeforeAndAfterAsJson() {
            when(repository.save(any(AdminAction.class))).thenAnswer(inv -> inv.getArgument(0));

            AdminActionRequest request = new AdminActionRequest(
                    UUID.randomUUID(), "UPDATE", "ROLE", UUID.randomUUID(),
                    Map.of("name", "old_name"), Map.of("name", "new_name"), null);

            logger.logAction(request);

            ArgumentCaptor<AdminAction> captor = ArgumentCaptor.forClass(AdminAction.class);
            verify(repository).save(captor.capture());

            assertThat(captor.getValue().getBeforeState()).contains("old_name");
            assertThat(captor.getValue().getAfterState()).contains("new_name");
        }
    }
}
