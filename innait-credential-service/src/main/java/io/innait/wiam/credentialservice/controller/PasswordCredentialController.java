package io.innait.wiam.credentialservice.controller;

import io.innait.wiam.common.dto.ApiResponse;
import io.innait.wiam.credentialservice.dto.PasswordChangeRequest;
import io.innait.wiam.credentialservice.dto.PasswordEnrollRequest;
import io.innait.wiam.credentialservice.dto.PasswordResetRequest;
import io.innait.wiam.credentialservice.dto.PasswordVerifyRequest;
import io.innait.wiam.credentialservice.service.PasswordCredentialService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/credentials/password")
public class PasswordCredentialController {

    private final PasswordCredentialService passwordService;

    public PasswordCredentialController(PasswordCredentialService passwordService) {
        this.passwordService = passwordService;
    }

    @PostMapping("/enroll")
    public ResponseEntity<ApiResponse<Void>> enroll(@Valid @RequestBody PasswordEnrollRequest request) {
        passwordService.enrollPassword(request.accountId(), request.password());
        return ResponseEntity.ok(ApiResponse.success(null));
    }

    @PostMapping("/verify")
    public ResponseEntity<ApiResponse<Map<String, Boolean>>> verify(
            @Valid @RequestBody PasswordVerifyRequest request) {
        boolean valid = passwordService.verifyPassword(request.accountId(), request.password());
        return ResponseEntity.ok(ApiResponse.success(Map.of("valid", valid)));
    }

    @PostMapping("/change")
    public ResponseEntity<ApiResponse<Void>> change(@Valid @RequestBody PasswordChangeRequest request) {
        passwordService.changePassword(request.accountId(), request.oldPassword(), request.newPassword());
        return ResponseEntity.ok(ApiResponse.success(null));
    }

    @PostMapping("/reset")
    public ResponseEntity<ApiResponse<Void>> reset(@Valid @RequestBody PasswordResetRequest request) {
        passwordService.resetPassword(request.accountId(), request.newPassword(), request.forcedBy());
        return ResponseEntity.ok(ApiResponse.success(null));
    }
}
