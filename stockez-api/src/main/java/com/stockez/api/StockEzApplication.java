package com.stockez.api;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.domain.EntityScan;
import org.springframework.data.jpa.repository.config.EnableJpaAuditing;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * StockEz - Enterprise FMCG Distribution Management Platform
 * Main entry point for the Spring Boot application.
 */
@SpringBootApplication(scanBasePackages = {"com.stockez"})
@EntityScan(basePackages = {"com.stockez"})
@EnableJpaRepositories(basePackages = {"com.stockez"})
@EnableJpaAuditing(auditorAwareRef = "auditorAware")
@EnableScheduling
public class StockEzApplication {

    public static void main(String[] args) {
        SpringApplication.run(StockEzApplication.class, args);
    }
}
