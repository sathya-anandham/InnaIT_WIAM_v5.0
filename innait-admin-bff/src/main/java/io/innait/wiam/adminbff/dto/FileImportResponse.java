package io.innait.wiam.adminbff.dto;

import java.util.List;
import java.util.UUID;

public record FileImportResponse(
        UUID jobId,
        int totalRows,
        int validRows,
        int errorRows,
        List<FileValidationError> errors
) {}
