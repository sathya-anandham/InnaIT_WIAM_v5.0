package io.innait.wiam.credentialservice.controller;

import io.innait.wiam.common.dto.ApiResponse;
import io.innait.wiam.credentialservice.dto.TotpEnrollmentResponse;
import io.innait.wiam.credentialservice.dto.TotpVerifyRequest;
import io.innait.wiam.credentialservice.service.TotpCredentialService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/credentials/totp")
public class TotpCredentialController {

    private final TotpCredentialService totpService;

    public TotpCredentialController(TotpCredentialService totpService) {
        this.totpService = totpService;
    }

    @PostMapping("/enroll")
    public ResponseEntity<ApiResponse<TotpEnrollmentResponse>> enroll(@RequestParam UUID accountId) {
        TotpEnrollmentResponse response = totpService.beginEnrollment(accountId);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @PostMapping("/confirm")
    public ResponseEntity<ApiResponse<Map<String, Boolean>>> confirm(
            @Valid @RequestBody TotpVerifyRequest request) {
        boolean confirmed = totpService.confirmEnrollment(request.accountId(), request.code());
        return ResponseEntity.ok(ApiResponse.success(Map.of("confirmed", confirmed)));
    }

    @PostMapping("/verify")
    public ResponseEntity<ApiResponse<Map<String, Boolean>>> verify(
            @Valid @RequestBody TotpVerifyRequest request) {
        boolean valid = totpService.verifyTotp(request.accountId(), request.code());
        return ResponseEntity.ok(ApiResponse.success(Map.of("valid", valid)));
    }

    @DeleteMapping("/{credentialId}")
    public ResponseEntity<ApiResponse<Void>> revoke(@PathVariable UUID credentialId,
                                                     @RequestParam UUID accountId) {
        totpService.revokeTotp(accountId, credentialId);
        return ResponseEntity.ok(ApiResponse.success(null));
    }
}
