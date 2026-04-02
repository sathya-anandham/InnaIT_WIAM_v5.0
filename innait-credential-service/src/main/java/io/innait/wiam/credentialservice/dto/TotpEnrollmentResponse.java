package io.innait.wiam.credentialservice.dto;

import java.util.UUID;

public record TotpEnrollmentResponse(
        UUID credentialId,
        String secretUri,
        String manualEntryKey
) {
}
