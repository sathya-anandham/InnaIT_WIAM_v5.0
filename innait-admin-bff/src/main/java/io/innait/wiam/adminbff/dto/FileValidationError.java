package io.innait.wiam.adminbff.dto;

public record FileValidationError(
        int row,
        String column,
        String message
) {}
