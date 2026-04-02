package io.innait.wiam.tokenservice.config;

import io.innait.wiam.tokenservice.service.KeyPairHolder;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class TokenServiceConfig {

    @Value("${wiam.token.key-overlap-seconds:86400}")
    private long keyOverlapSeconds; // 24 hours

    @Bean
    public KeyPairHolder keyPairHolder() {
        return new KeyPairHolder(keyOverlapSeconds);
    }
}
