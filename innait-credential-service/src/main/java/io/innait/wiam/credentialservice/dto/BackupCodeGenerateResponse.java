package io.innait.wiam.credentialservice.dto;

import java.util.List;

public record BackupCodeGenerateResponse(
        List<String> codes,
        int totalCount
) {
}
