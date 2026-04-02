package io.innait.wiam.tokenservice.controller;

import io.innait.wiam.tokenservice.service.TokenService;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
public class JwksController {

    private final TokenService tokenService;

    public JwksController(TokenService tokenService) {
        this.tokenService = tokenService;
    }

    @GetMapping(value = "/.well-known/jwks.json", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Map<String, Object>> getJwks() {
        return ResponseEntity.ok(tokenService.getJwks().toJSONObject());
    }
}
