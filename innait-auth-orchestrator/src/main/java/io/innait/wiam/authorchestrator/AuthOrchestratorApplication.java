package io.innait.wiam.authorchestrator;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication(scanBasePackages = "io.innait.wiam")
public class AuthOrchestratorApplication {

    public static void main(String[] args) {
        SpringApplication.run(AuthOrchestratorApplication.class, args);
    }
}
