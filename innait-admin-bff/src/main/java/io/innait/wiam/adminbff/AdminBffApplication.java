package io.innait.wiam.adminbff;

import io.innait.wiam.common.security.SecurityConfig;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.context.annotation.FilterType;

@SpringBootApplication
@ComponentScan(
        basePackages = "io.innait.wiam",
        excludeFilters = @ComponentScan.Filter(
                type = FilterType.ASSIGNABLE_TYPE,
                classes = SecurityConfig.class
        )
)
public class AdminBffApplication {

    public static void main(String[] args) {
        SpringApplication.run(AdminBffApplication.class, args);
    }
}
