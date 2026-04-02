package io.innait.wiam.credentialservice.controller;

import io.innait.wiam.common.dto.ApiResponse;
import io.innait.wiam.credentialservice.dto.*;
import io.innait.wiam.credentialservice.service.SoftTokenCredentialService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/credentials/softtoken")
public class SoftTokenCredentialController {

    private final SoftTokenCredentialService softTokenService;

    public SoftTokenCredentialController(SoftTokenCredentialService softTokenService) {
        this.softTokenService = softTokenService;
    }

    @PostMapping("/provision")
    public ResponseEntity<ApiResponse<SoftTokenProvisionResponse>> provision(
            @Valid @RequestBody SoftTokenProvisionRequest request) {
        SoftTokenProvisionResponse response = softTokenService.provision(
                request.accountId(), request.devicePlatform(), request.deviceName());
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @PostMapping("/activate")
    public ResponseEntity<ApiResponse<Map<String, Boolean>>> activate(
            @Valid @RequestBody SoftTokenActivateRequest request) {
        boolean activated = softTokenService.activate(
                request.deviceId(), request.activationCode(), request.pushToken());
        return ResponseEntity.ok(ApiResponse.success(Map.of("activated", activated)));
    }

    @PostMapping("/challenge")
    public ResponseEntity<ApiResponse<SoftTokenChallengeResponse>> sendChallenge(
            @RequestParam UUID accountId) {
        SoftTokenChallengeResponse response = softTokenService.sendPushChallenge(accountId);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @PostMapping("/verify")
    public ResponseEntity<ApiResponse<Map<String, Boolean>>> verify(
            @Valid @RequestBody SoftTokenVerifyRequest request) {
        boolean valid = softTokenService.verifyPushResponse(
                request.challengeId(), request.signedResponse());
        return ResponseEntity.ok(ApiResponse.success(Map.of("valid", valid)));
    }

    @DeleteMapping("/{credentialId}")
    public ResponseEntity<ApiResponse<Void>> revokeCredential(
            @PathVariable UUID credentialId,
            @RequestParam UUID accountId) {
        softTokenService.revokeCredential(accountId, credentialId);
        return ResponseEntity.ok(ApiResponse.success(null));
    }

    @GetMapping
    public ResponseEntity<ApiResponse<List<SoftTokenCredentialResponse>>> listCredentials(
            @RequestParam UUID accountId) {
        List<SoftTokenCredentialResponse> credentials = softTokenService.listCredentials(accountId);
        return ResponseEntity.ok(ApiResponse.success(credentials));
    }
}
