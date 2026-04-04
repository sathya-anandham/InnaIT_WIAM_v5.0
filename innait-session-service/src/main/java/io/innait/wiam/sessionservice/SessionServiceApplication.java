package io.innait.wiam.sessionservice;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication(scanBasePackages = "io.innait.wiam")
public class SessionServiceApplication {

    public static void main(String[] args) {
        SpringApplication.run(SessionServiceApplication.class, args);
    }
}
