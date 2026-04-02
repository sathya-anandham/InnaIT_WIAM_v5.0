package io.innait.wiam.common.event.payload;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.UUID;

@JsonIgnoreProperties(ignoreUnknown = true)
public record UserCreatedPayload(
        @JsonProperty("user_id") UUID userId,
        @JsonProperty("tenant_id") UUID tenantId,
        @JsonProperty("user_type") String userType,
        @JsonProperty("department") String department,
        @JsonProperty("designation") String designation,
        @JsonProperty("org_unit_id") UUID orgUnitId,
        @JsonProperty("manager_user_id") UUID managerUserId,
        @JsonProperty("email") String email,
        @JsonProperty("created_by") UUID createdBy,
        @JsonProperty("creation_method") String creationMethod
) {
}
