package io.innait.wiam.common.event.payload;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@JsonIgnoreProperties(ignoreUnknown = true)
public record UserUpdatedPayload(
        @JsonProperty("user_id") UUID userId,
        @JsonProperty("changed_fields") List<String> changedFields,
        @JsonProperty("old_values") Map<String, Object> oldValues,
        @JsonProperty("new_values") Map<String, Object> newValues,
        @JsonProperty("updated_by") UUID updatedBy
) {
}
