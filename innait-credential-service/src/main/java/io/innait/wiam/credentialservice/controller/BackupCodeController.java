package io.innait.wiam.credentialservice.controller;

import io.innait.wiam.common.dto.ApiResponse;
import io.innait.wiam.credentialservice.dto.BackupCodeGenerateResponse;
import io.innait.wiam.credentialservice.dto.BackupCodeVerifyRequest;
import io.innait.wiam.credentialservice.service.BackupCodeService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/credentials/backup-codes")
public class BackupCodeController {

    private final BackupCodeService backupCodeService;

    public BackupCodeController(BackupCodeService backupCodeService) {
        this.backupCodeService = backupCodeService;
    }

    @PostMapping("/generate")
    public ResponseEntity<ApiResponse<BackupCodeGenerateResponse>> generate(@RequestParam UUID accountId) {
        BackupCodeGenerateResponse response = backupCodeService.generate(accountId);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @PostMapping("/verify")
    public ResponseEntity<ApiResponse<Map<String, Boolean>>> verify(
            @Valid @RequestBody BackupCodeVerifyRequest request) {
        boolean valid = backupCodeService.verify(request.accountId(), request.code());
        return ResponseEntity.ok(ApiResponse.success(Map.of("valid", valid)));
    }

    @GetMapping("/remaining")
    public ResponseEntity<ApiResponse<Map<String, Integer>>> remaining(@RequestParam UUID accountId) {
        int count = backupCodeService.getRemainingCount(accountId);
        return ResponseEntity.ok(ApiResponse.success(Map.of("remaining", count)));
    }
}
