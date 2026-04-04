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

    // ---- Magic Link Bootstrap Flow ----

    @PostMapping("/login/magic-link/send")
    public ResponseEntity<ApiResponse<MagicLinkSendResponse>> sendMagicLink(
            @Valid @RequestBody MagicLinkSendRequest request) {
        MagicLinkSendResponse response = authService.sendMagicLink(request);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @GetMapping("/login/magic-link/verify")
    public ResponseEntity<ApiResponse<MagicLinkVerifyResponse>> verifyMagicLink(
            @RequestParam String token) {
        MagicLinkVerifyResponse response = authService.verifyMagicLink(token);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    // ---- Bootstrap Session ----

    @PostMapping("/bootstrap/session/validate")
    public ResponseEntity<ApiResponse<BootstrapSessionResponse>> validateBootstrapSession(
            @Valid @RequestBody BootstrapSessionValidateRequest request) {
        BootstrapSessionResponse response = authService.validateBootstrapSession(request);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @PostMapping("/bootstrap/session/expire")
    public ResponseEntity<ApiResponse<BootstrapSessionResponse>> expireBootstrapSession(
            @Valid @RequestBody BootstrapSessionValidateRequest request) {
        BootstrapSessionResponse response = authService.expireBootstrapSession(request.sessionId());
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    // ---- Bootstrap FIDO Enrollment ----

    @PostMapping("/bootstrap/{txnId}/fido-enrollment/start")
    public ResponseEntity<ApiResponse<AuthStatusResponse>> startFidoEnrollment(
            @PathVariable UUID txnId) {
        AuthStatusResponse response = authService.startFidoEnrollment(txnId);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @PostMapping("/bootstrap/{txnId}/fido-enrollment/complete")
    public ResponseEntity<ApiResponse<AuthStatusResponse>> completeFidoEnrollment(
            @PathVariable UUID txnId) {
        AuthStatusResponse response = authService.completeFidoEnrollment(txnId);
        return ResponseEntity.ok(ApiResponse.success(response));
    }
}
