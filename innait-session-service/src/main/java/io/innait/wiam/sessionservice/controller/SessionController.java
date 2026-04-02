package io.innait.wiam.sessionservice.controller;

import io.innait.wiam.common.dto.ApiResponse;
import io.innait.wiam.sessionservice.dto.*;
import io.innait.wiam.sessionservice.service.SessionService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/sessions")
public class SessionController {

    private final SessionService sessionService;

    public SessionController(SessionService sessionService) {
        this.sessionService = sessionService;
    }

    @PostMapping
    public ResponseEntity<ApiResponse<UUID>> createSession(
            @Valid @RequestBody CreateSessionRequest request) {
        UUID sessionId = sessionService.createSession(request);
        return ResponseEntity.ok(ApiResponse.success(sessionId));
    }

    @GetMapping("/{sessionId}")
    public ResponseEntity<ApiResponse<SessionResponse>> getSession(@PathVariable UUID sessionId) {
        SessionResponse response = sessionService.getSession(sessionId);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @DeleteMapping("/{sessionId}")
    public ResponseEntity<ApiResponse<Void>> revokeSession(
            @PathVariable UUID sessionId,
            @RequestParam(defaultValue = "user_request") String reason,
            @RequestParam(required = false) String revokedBy) {
        sessionService.revokeSession(sessionId, reason, revokedBy != null ? revokedBy : "system");
        return ResponseEntity.ok(ApiResponse.success(null));
    }

    @GetMapping("/account/{accountId}")
    public ResponseEntity<ApiResponse<List<SessionResponse>>> listActiveSessions(
            @PathVariable UUID accountId) {
        List<SessionResponse> sessions = sessionService.listActiveSessions(accountId);
        return ResponseEntity.ok(ApiResponse.success(sessions));
    }

    @PatchMapping("/{sessionId}/device-context")
    public ResponseEntity<ApiResponse<Void>> updateDeviceContext(
            @PathVariable UUID sessionId,
            @Valid @RequestBody DeviceContextUpdateRequest request) {
        sessionService.updateDeviceContext(sessionId, request);
        return ResponseEntity.ok(ApiResponse.success(null));
    }

    @PostMapping("/{sessionId}/refresh")
    public ResponseEntity<ApiResponse<RefreshTokenResponse>> refreshSession(
            @PathVariable UUID sessionId,
            @Valid @RequestBody RefreshTokenRequest request) {
        RefreshTokenResponse response = sessionService.refreshSession(sessionId, request.refreshToken());
        return ResponseEntity.ok(ApiResponse.success(response));
    }
}
