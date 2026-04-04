package io.innait.wiam.adminconfigservice;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication(scanBasePackages = "io.innait.wiam")
public class AdminConfigServiceApplication {

    public static void main(String[] args) {
        SpringApplication.run(AdminConfigServiceApplication.class, args);
    }
}
