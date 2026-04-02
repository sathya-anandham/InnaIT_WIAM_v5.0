package io.innait.wiam.authorchestrator.controller;

import io.innait.wiam.authorchestrator.dto.*;
import io.innait.wiam.authorchestrator.service.AuthOrchestrationService;
import io.innait.wiam.common.dto.ApiResponse;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {

    private final AuthOrchestrationService authService;

    public AuthController(AuthOrchestrationService authService) {
        this.authService = authService;
    }

    @PostMapping("/login/initiate")
    public ResponseEntity<ApiResponse<AuthInitiateResponse>> initiate(
            @Valid @RequestBody AuthInitiateRequest request) {
        AuthInitiateResponse response = authService.initiateAuth(request);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @PostMapping("/login/primary")
    public ResponseEntity<ApiResponse<PrimaryFactorResponse>> submitPrimary(
            @Valid @RequestBody FactorSubmitRequest request) {
        PrimaryFactorResponse response = authService.submitPrimaryFactor(request);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @PostMapping("/login/mfa")
    public ResponseEntity<ApiResponse<MfaFactorResponse>> submitMfa(
            @Valid @RequestBody FactorSubmitRequest request) {
        MfaFactorResponse response = authService.submitMfaFactor(request);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @GetMapping("/login/{txnId}/status")
    public ResponseEntity<ApiResponse<AuthStatusResponse>> getStatus(@PathVariable UUID txnId) {
        AuthStatusResponse response = authService.getAuthStatus(txnId);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @PostMapping("/login/{txnId}/abort")
    public ResponseEntity<ApiResponse<AuthStatusResponse>> abort(@PathVariable UUID txnId) {
        AuthStatusResponse response = authService.abortAuth(txnId);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @PostMapping("/step-up/initiate")
    public ResponseEntity<ApiResponse<AuthInitiateResponse>> initiateStepUp(
            @Valid @RequestBody StepUpInitiateRequest request) {
        AuthInitiateResponse response = authService.initiateStepUp(request);
        return ResponseEntity.ok(ApiResponse.success(response));
    }
}
