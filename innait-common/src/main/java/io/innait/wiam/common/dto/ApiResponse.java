package io.innait.wiam.common.dto;

import com.fasterxml.jackson.annotation.JsonInclude;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record ApiResponse<T>(
        Status status,
        T data,
        ErrorDetail error,
        PageMeta meta
) {

    public enum Status {
        SUCCESS, ERROR
    }

    public record ErrorDetail(String code, String message) {
    }

    public record PageMeta(int page, int size, long total) {
    }

    public static <T> ApiResponse<T> success(T data) {
        return new ApiResponse<>(Status.SUCCESS, data, null, null);
    }

    public static <T> ApiResponse<T> success(T data, PageMeta meta) {
        return new ApiResponse<>(Status.SUCCESS, data, null, meta);
    }

    public static <T> ApiResponse<T> error(String code, String message) {
        return new ApiResponse<>(Status.ERROR, null, new ErrorDetail(code, message), null);
    }
}
