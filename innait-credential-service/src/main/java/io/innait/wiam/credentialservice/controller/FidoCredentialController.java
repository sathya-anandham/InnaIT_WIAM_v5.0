package io.innait.wiam.credentialservice.controller;

import io.innait.wiam.common.dto.ApiResponse;
import io.innait.wiam.credentialservice.dto.*;
import io.innait.wiam.credentialservice.service.FidoCredentialService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/credentials/fido")
public class FidoCredentialController {

    private final FidoCredentialService fidoService;

    public FidoCredentialController(FidoCredentialService fidoService) {
        this.fidoService = fidoService;
    }

    @PostMapping("/register/begin")
    public ResponseEntity<ApiResponse<FidoRegistrationBeginResponse>> beginRegistration(
            @Valid @RequestBody FidoRegistrationBeginRequest request) {
        FidoRegistrationBeginResponse response = fidoService.beginRegistration(
                request.accountId(), request.displayName());
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @PostMapping("/register/complete")
    public ResponseEntity<ApiResponse<FidoCredentialResponse>> completeRegistration(
            @Valid @RequestBody FidoRegistrationCompleteRequest request) {
        FidoCredentialResponse response = fidoService.completeRegistration(request);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @PostMapping("/authenticate/begin")
    public ResponseEntity<ApiResponse<FidoAuthenticationBeginResponse>> beginAuthentication(
            @RequestParam UUID accountId) {
        FidoAuthenticationBeginResponse response = fidoService.beginAuthentication(accountId);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @PostMapping("/authenticate/complete")
    public ResponseEntity<ApiResponse<Map<String, Boolean>>> completeAuthentication(
            @Valid @RequestBody FidoAuthenticationCompleteRequest request) {
        boolean valid = fidoService.completeAuthentication(request);
        return ResponseEntity.ok(ApiResponse.success(Map.of("valid", valid)));
    }

    @DeleteMapping("/{credentialId}")
    public ResponseEntity<ApiResponse<Void>> revokeCredential(
            @PathVariable UUID credentialId,
            @RequestParam UUID accountId) {
        fidoService.revokeCredential(accountId, credentialId);
        return ResponseEntity.ok(ApiResponse.success(null));
    }

    @GetMapping
    public ResponseEntity<ApiResponse<List<FidoCredentialResponse>>> listCredentials(
            @RequestParam UUID accountId) {
        List<FidoCredentialResponse> credentials = fidoService.listCredentials(accountId);
        return ResponseEntity.ok(ApiResponse.success(credentials));
    }

    // ---- Device-Aware Registration (Bootstrap / Onboarding Flow) ----

    @PostMapping("/register/device-aware/begin")
    public ResponseEntity<ApiResponse<FidoRegistrationBeginResponse>> beginDeviceAwareRegistration(
            @Valid @RequestBody DeviceAwareFidoRegistrationBeginRequest request) {
        FidoRegistrationBeginResponse response = fidoService.beginDeviceAwareRegistration(
                request.accountId(), request.deviceId(), request.displayName());
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @PostMapping("/register/device-aware/complete")
    public ResponseEntity<ApiResponse<FidoCredentialResponse>> completeDeviceAwareRegistration(
            @Valid @RequestBody DeviceAwareFidoRegistrationCompleteRequest request) {
        FidoCredentialResponse response = fidoService.completeDeviceAwareRegistration(request);
        return ResponseEntity.ok(ApiResponse.success(response));
    }
}
