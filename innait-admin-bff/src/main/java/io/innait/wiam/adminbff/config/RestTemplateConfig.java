package io.innait.wiam.adminbff.config;

import io.innait.wiam.common.context.CorrelationContext;
import io.innait.wiam.common.context.TenantContext;
import io.innait.wiam.common.security.InnaITAuthenticationToken;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.ClientHttpRequestInterceptor;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.client.RestTemplate;

import java.util.List;
import java.util.UUID;

@Configuration
public class RestTemplateConfig {

    @Bean
    public RestTemplate restTemplate() {
        RestTemplate restTemplate = new RestTemplate();
        restTemplate.setInterceptors(List.of(headerForwardingInterceptor()));
        return restTemplate;
    }

    private ClientHttpRequestInterceptor headerForwardingInterceptor() {
        return (request, body, execution) -> {
            // Forward JWT token
            Authentication auth = SecurityContextHolder.getContext().getAuthentication();
            if (auth instanceof InnaITAuthenticationToken token) {
                String rawToken = (String) token.getCredentials();
                if (rawToken != null) {
                    request.getHeaders().set("Authorization", "Bearer " + rawToken);
                }
            }

            // Forward tenant ID
            UUID tenantId = TenantContext.getTenantId();
            if (tenantId != null) {
                request.getHeaders().set("X-Tenant-ID", tenantId.toString());
            }

            // Forward correlation ID
            UUID correlationId = CorrelationContext.getCorrelationId();
            if (correlationId != null) {
                request.getHeaders().set("X-Correlation-ID", correlationId.toString());
            }

            return execution.execute(request, body);
        };
    }
}
