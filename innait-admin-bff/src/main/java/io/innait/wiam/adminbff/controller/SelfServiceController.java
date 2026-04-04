package io.innait.wiam.adminbff.controller;

import io.innait.wiam.adminbff.client.DeviceServiceClient;
import io.innait.wiam.adminbff.dto.*;
import io.innait.wiam.adminbff.service.AccountRecoveryService;
import io.innait.wiam.adminbff.service.ForgotPasswordService;
import io.innait.wiam.adminbff.service.OnboardingService;
import io.innait.wiam.adminbff.service.SelfServiceFacade;
import io.innait.wiam.common.dto.ApiResponse;
import io.innait.wiam.common.security.InnaITAuthenticationToken;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/self")
public class SelfServiceController {

    private final SelfServiceFacade selfService;
    private final ForgotPasswordService forgotPasswordService;
    private final AccountRecoveryService accountRecoveryService;
    private final OnboardingService onboardingService;
    private final DeviceServiceClient deviceClient;

    public SelfServiceController(SelfServiceFacade selfService,
                                  ForgotPasswordService forgotPasswordService,
                                  AccountRecoveryService accountRecoveryService,
                                  OnboardingService onboardingService,
                                  DeviceServiceClient deviceClient) {
        this.selfService = selfService;
        this.forgotPasswordService = forgotPasswordService;
        this.accountRecoveryService = accountRecoveryService;
        this.onboardingService = onboardingService;
        this.deviceClient = deviceClient;
    }

    // ---- Profile ----

    @GetMapping("/profile")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getMyProfile() {
        return ResponseEntity.ok(ApiResponse.success(selfService.getMyProfile()));
    }

    @PatchMapping("/profile")
    public ResponseEntity<ApiResponse<Map<String, Object>>> updateMyProfile(
            @Valid @RequestBody UpdateProfileRequest request) {
        return ResponseEntity.ok(ApiResponse.success(selfService.updateMyProfile(request)));
    }

    @PatchMapping("/profile/email")
    public ResponseEntity<ApiResponse<Map<String, Object>>> changeEmail(
            @Valid @RequestBody ChangeEmailRequest request) {
        return ResponseEntity.ok(ApiResponse.success(selfService.changeEmail(request)));
    }

    // ---- Credentials ----

    @PostMapping("/credentials/password/change")
    public ResponseEntity<ApiResponse<Void>> changePassword(
            @Valid @RequestBody ChangePasswordRequest request) {
        selfService.changePassword(request);
        return ResponseEntity.ok(ApiResponse.success(null));
    }

    @PostMapping("/credentials/totp/enroll")
    public ResponseEntity<ApiResponse<Map<String, Object>>> enrollTotp() {
        return ResponseEntity.ok(ApiResponse.success(selfService.enrollTotp()));
    }

    @PostMapping("/credentials/fido/register")
    public ResponseEntity<ApiResponse<Map<String, Object>>> registerFidoBegin() {
        return ResponseEntity.ok(ApiResponse.success(selfService.registerFidoBegin()));
    }

    @PostMapping("/credentials/fido/register/complete")
    public ResponseEntity<ApiResponse<Map<String, Object>>> registerFidoComplete(
            @RequestBody Map<String, Object> attestation) {
        return ResponseEntity.ok(ApiResponse.success(selfService.registerFidoComplete(attestation)));
    }

    // ---- Sessions ----

    @GetMapping("/sessions")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> getMySessions() {
        return ResponseEntity.ok(ApiResponse.success(selfService.getMySessions()));
    }

    @DeleteMapping("/sessions/{sessionId}")
    public ResponseEntity<ApiResponse<Void>> revokeMySession(@PathVariable UUID sessionId) {
        selfService.revokeMySession(sessionId);
        return ResponseEntity.ok(ApiResponse.success(null));
    }

    @GetMapping("/activity")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> getMyActivity() {
        return ResponseEntity.ok(ApiResponse.success(selfService.getMyActivity()));
    }

    // ---- Forgot Password (public — no auth required) ----

    @PostMapping("/credentials/password/forgot")
    public ResponseEntity<ApiResponse<Map<String, String>>> forgotPassword(
            @Valid @RequestBody ForgotPasswordRequest request) {
        return ResponseEntity.ok(ApiResponse.success(forgotPasswordService.initiateForgotPassword(request)));
    }

    @PostMapping("/credentials/password/verify-otp")
    public ResponseEntity<ApiResponse<Map<String, String>>> verifyOtp(
            @Valid @RequestBody VerifyOtpRequest request) {
        return ResponseEntity.ok(ApiResponse.success(forgotPasswordService.verifyOtp(request)));
    }

    @PostMapping("/credentials/password/reset")
    public ResponseEntity<ApiResponse<Map<String, String>>> resetPassword(
            @Valid @RequestBody ResetPasswordRequest request) {
        return ResponseEntity.ok(ApiResponse.success(forgotPasswordService.resetPassword(request)));
    }

    // ---- Account Recovery (public — no auth required) ----

    @PostMapping("/recovery")
    public ResponseEntity<ApiResponse<Map<String, Object>>> recoverAccount(
            @Valid @RequestBody RecoveryRequest request,
            HttpServletRequest httpRequest) {
        return ResponseEntity.ok(ApiResponse.success(
                accountRecoveryService.recoverWithBackupCode(request, httpRequest)));
    }

    // ---- Onboarding (authenticated) ----

    @PostMapping("/onboarding/accept-terms")
    public ResponseEntity<ApiResponse<Map<String, Object>>> acceptTerms() {
        return ResponseEntity.ok(ApiResponse.success(
                onboardingService.acceptTerms(currentUserId())));
    }

    @PostMapping("/onboarding/set-password")
    public ResponseEntity<ApiResponse<Map<String, Object>>> onboardingSetPassword(
            @Valid @RequestBody OnboardingSetPasswordRequest request) {
        return ResponseEntity.ok(ApiResponse.success(
                onboardingService.setPassword(currentUserId(), request)));
    }

    @PostMapping("/onboarding/enroll-mfa")
    public ResponseEntity<ApiResponse<Map<String, Object>>> onboardingEnrollMfa(
            @Valid @RequestBody OnboardingEnrollMfaRequest request) {
        return ResponseEntity.ok(ApiResponse.success(
                onboardingService.enrollMfa(currentUserId(), request)));
    }

    @PostMapping("/onboarding/complete")
    public ResponseEntity<ApiResponse<Map<String, Object>>> completeOnboarding() {
        return ResponseEntity.ok(ApiResponse.success(
                onboardingService.completeOnboarding(currentUserId())));
    }

    // ---- D. End-user Self-Service: Devices ----

    @GetMapping("/devices")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> getMyAssignedDevices() {
        InnaITAuthenticationToken auth = (InnaITAuthenticationToken)
                SecurityContextHolder.getContext().getAuthentication();
        return ResponseEntity.ok(ApiResponse.success(
                deviceClient.listAssignmentsByUser(auth.getUserId())));
    }

    @GetMapping("/devices/eligible")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> getMyEligibleDevices() {
        // Eligible devices are resolved by userId via downstream service
        return ResponseEntity.ok(ApiResponse.success(
                deviceClient.listAssignmentsByUser(currentUserId())));
    }

    @PostMapping("/devices/validate-enrollment")
    public ResponseEntity<ApiResponse<Map<String, Object>>> validateMyEnrollment(
            @RequestBody Map<String, Object> request) {
        request.put("userId", currentUserId().toString());
        return ResponseEntity.ok(ApiResponse.success(deviceClient.validateEnrollment(request)));
    }

    private UUID currentUserId() {
        InnaITAuthenticationToken token = (InnaITAuthenticationToken)
                SecurityContextHolder.getContext().getAuthentication();
        return token.getUserId();
    }
}
