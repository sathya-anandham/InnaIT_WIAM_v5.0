package io.innait.wiam.tokenservice.controller;

import io.innait.wiam.common.dto.ApiResponse;
import io.innait.wiam.tokenservice.dto.*;
import io.innait.wiam.tokenservice.service.TokenService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/tokens")
public class TokenController {

    private final TokenService tokenService;

    public TokenController(TokenService tokenService) {
        this.tokenService = tokenService;
    }

    @PostMapping("/issue")
    public ResponseEntity<ApiResponse<TokenIssueResponse>> issueTokens(
            @Valid @RequestBody TokenIssueRequest request) {
        TokenIssueResponse response = tokenService.issueTokens(request);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @PostMapping("/validate")
    public ResponseEntity<ApiResponse<TokenValidationResponse>> validateToken(
            @RequestBody String jwt) {
        TokenValidationResponse response = tokenService.validateToken(jwt.trim());
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @PostMapping("/revoke")
    public ResponseEntity<ApiResponse<Void>> revokeToken(
            @Valid @RequestBody TokenRevokeRequest request) {
        tokenService.revokeToken(request.token());
        return ResponseEntity.ok(ApiResponse.success(null));
    }

    @PostMapping("/rotate-keys")
    public ResponseEntity<ApiResponse<Void>> rotateKeys() {
        tokenService.rotateKeys();
        return ResponseEntity.ok(ApiResponse.success(null));
    }
}
