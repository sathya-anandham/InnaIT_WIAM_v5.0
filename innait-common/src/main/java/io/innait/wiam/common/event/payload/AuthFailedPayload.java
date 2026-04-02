package io.innait.wiam.common.event.payload;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.List;
import java.util.UUID;

@JsonIgnoreProperties(ignoreUnknown = true)
public record AuthFailedPayload(
        @JsonProperty("account_id") UUID accountId,
        @JsonProperty("auth_methods") List<String> authMethods,
        @JsonProperty("source_ip") String sourceIp,
        @JsonProperty("channel_type") String channelType,
        @JsonProperty("risk_score") Double riskScore,
        @JsonProperty("failure_reason_code") String failureReasonCode
) {
}
