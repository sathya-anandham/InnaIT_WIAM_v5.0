package io.innait.wiam.apigateway.controller;

import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

import java.util.Map;

/**
 * Fallback controller for circuit breaker.
 * Returns 503 Service Unavailable with error envelope when downstream services are unavailable.
 */
@RestController
@RequestMapping("/fallback")
public class FallbackController {

    @RequestMapping(method = {RequestMethod.GET, RequestMethod.POST})
    public Mono<Map<String, Object>> fallback(ServerWebExchange exchange) {
        exchange.getResponse().setStatusCode(HttpStatus.SERVICE_UNAVAILABLE);
        exchange.getResponse().getHeaders().setContentType(MediaType.APPLICATION_JSON);

        return Mono.just(Map.of(
                "status", "ERROR",
                "error", Map.of(
                        "code", "SERVICE_UNAVAILABLE",
                        "message", "The requested service is temporarily unavailable. Please try again later."
                )
        ));
    }
}
