package io.innait.wiam.credentialservice.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;

import java.util.List;

public record BulkImportDeviceRequest(
        @NotEmpty @Valid List<RegisterDeviceRequest> devices
) {
}
