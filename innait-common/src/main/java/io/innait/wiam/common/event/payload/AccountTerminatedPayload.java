package io.innait.wiam.common.event.payload;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.UUID;

@JsonIgnoreProperties(ignoreUnknown = true)
public record AccountTerminatedPayload(
        @JsonProperty("account_id") UUID accountId,
        @JsonProperty("user_id") UUID userId,
        @JsonProperty("terminated_by") UUID terminatedBy,
        @JsonProperty("cascade_summary") CascadeSummary cascadeSummary
) {

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record CascadeSummary(
            @JsonProperty("sessions_revoked") int sessionsRevoked,
            @JsonProperty("credentials_revoked") int credentialsRevoked,
            @JsonProperty("roles_removed") int rolesRemoved
    ) {
    }
}
