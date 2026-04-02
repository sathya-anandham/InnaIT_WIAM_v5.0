package io.innait.wiam.auditservice.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import io.innait.wiam.auditservice.dto.AdminActionRequest;
import io.innait.wiam.auditservice.dto.AdminActionResponse;
import io.innait.wiam.auditservice.entity.AdminAction;
import io.innait.wiam.auditservice.repository.AdminActionRepository;
import io.innait.wiam.common.context.TenantContext;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Iterator;
import java.util.Map;
import java.util.UUID;

@Service
public class AdminActionLogger {

    private static final Logger log = LoggerFactory.getLogger(AdminActionLogger.class);

    private final AdminActionRepository adminActionRepository;
    private final ObjectMapper objectMapper;

    public AdminActionLogger(AdminActionRepository adminActionRepository, ObjectMapper objectMapper) {
        this.adminActionRepository = adminActionRepository;
        this.objectMapper = objectMapper;
    }

    @Transactional
    public AdminActionResponse logAction(AdminActionRequest request) {
        UUID tenantId = TenantContext.requireTenantId();

        String beforeJson = serializeToJson(request.beforeState());
        String afterJson = serializeToJson(request.afterState());

        AdminAction action = new AdminAction(
                UUID.randomUUID(),
                tenantId,
                request.adminId(),
                request.actionType(),
                request.targetType(),
                request.targetId(),
                beforeJson,
                afterJson,
                request.justification(),
                Instant.now()
        );

        adminActionRepository.save(action);
        log.info("Logged admin action [{}] by admin [{}] on [{}:{}]",
                request.actionType(), request.adminId(),
                request.targetType(), request.targetId());

        return toResponse(action);
    }

    /**
     * Compute a field-level JSON diff between two objects.
     * Returns a JSON object where each changed field has { "old": ..., "new": ... }.
     */
    public String computeDiff(Object before, Object after) {
        JsonNode beforeNode = objectMapper.valueToTree(before != null ? before : Map.of());
        JsonNode afterNode = objectMapper.valueToTree(after != null ? after : Map.of());

        ObjectNode diff = objectMapper.createObjectNode();

        // Check all fields in the 'after' object
        Iterator<String> fieldNames = afterNode.fieldNames();
        while (fieldNames.hasNext()) {
            String field = fieldNames.next();
            JsonNode oldVal = beforeNode.get(field);
            JsonNode newVal = afterNode.get(field);

            if (oldVal == null && newVal != null) {
                ObjectNode change = objectMapper.createObjectNode();
                change.set("old", objectMapper.nullNode());
                change.set("new", newVal);
                diff.set(field, change);
            } else if (oldVal != null && !oldVal.equals(newVal)) {
                ObjectNode change = objectMapper.createObjectNode();
                change.set("old", oldVal);
                change.set("new", newVal);
                diff.set(field, change);
            }
        }

        // Check for fields removed in 'after'
        Iterator<String> beforeFields = beforeNode.fieldNames();
        while (beforeFields.hasNext()) {
            String field = beforeFields.next();
            if (!afterNode.has(field)) {
                ObjectNode change = objectMapper.createObjectNode();
                change.set("old", beforeNode.get(field));
                change.set("new", objectMapper.nullNode());
                diff.set(field, change);
            }
        }

        try {
            return objectMapper.writeValueAsString(diff);
        } catch (JsonProcessingException e) {
            return "{}";
        }
    }

    private String serializeToJson(Object obj) {
        if (obj == null) return null;
        try {
            if (obj instanceof String s) return s;
            return objectMapper.writeValueAsString(obj);
        } catch (JsonProcessingException e) {
            log.warn("Failed to serialize admin action state: {}", e.getMessage());
            return null;
        }
    }

    AdminActionResponse toResponse(AdminAction action) {
        return new AdminActionResponse(
                action.getAdminActionId(),
                action.getTenantId(),
                action.getAdminId(),
                action.getActionType(),
                action.getTargetType(),
                action.getTargetId(),
                action.getBeforeState(),
                action.getAfterState(),
                action.getJustification(),
                action.getActionTime()
        );
    }
}
