package io.innait.wiam.common.event.payload;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.UUID;

@JsonIgnoreProperties(ignoreUnknown = true)
public record AccountRoleRemovedPayload(
        @JsonProperty("account_id") UUID accountId,
        @JsonProperty("role_id") UUID roleId,
        @JsonProperty("role_code") String roleCode,
        @JsonProperty("assignment_source") String assignmentSource,
        @JsonProperty("removed_by") UUID removedBy,
        @JsonProperty("reason") String reason
) {
}
