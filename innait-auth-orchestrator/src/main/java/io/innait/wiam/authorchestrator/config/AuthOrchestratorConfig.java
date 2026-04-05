package io.innait.wiam.authorchestrator.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.client.RestTemplate;

@Configuration
public class AuthOrchestratorConfig {

    @Bean
    public RestTemplate restTemplate() {
        return new RestTemplate();
    }
}
