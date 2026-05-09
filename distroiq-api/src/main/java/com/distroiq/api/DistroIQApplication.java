package com.distroiq.api;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.domain.EntityScan;
import org.springframework.data.jpa.repository.config.EnableJpaAuditing;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * DistroIQ - Enterprise FMCG Distribution Management Platform
 * Main entry point for the Spring Boot application.
 */
@SpringBootApplication(scanBasePackages = {"com.distroiq"})
@EntityScan(basePackages = {"com.distroiq"})
@EnableJpaRepositories(basePackages = {"com.distroiq"})
@EnableJpaAuditing(auditorAwareRef = "auditorAware")
@EnableScheduling
public class DistroIQApplication {

    public static void main(String[] args) {
        SpringApplication.run(DistroIQApplication.class, args);
    }
}
