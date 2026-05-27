package com.stockez.api.config;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.*;
import io.swagger.v3.oas.models.security.*;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * OpenAPI 3 / Swagger configuration.
 * Access at: http://localhost:8080/swagger-ui.html
 */
@Configuration
public class OpenApiConfig {

    @Bean
    public OpenAPI StockEzOpenAPI() {
        return new OpenAPI()
            .info(new Info()
                .title("StockEz API")
                .description("Enterprise FMCG Distribution Management Platform — REST API Documentation")
                .version("v1.0.0")
                .contact(new Contact()
                    .name("StockEz Platform")
                    .email("support@StockEz.com"))
                .license(new License()
                    .name("Proprietary")
                    .url("https://StockEz.com")))
            .addSecurityItem(new SecurityRequirement().addList("Bearer Authentication"))
            .components(new io.swagger.v3.oas.models.Components()
                .addSecuritySchemes("Bearer Authentication",
                    new SecurityScheme()
                        .type(SecurityScheme.Type.HTTP)
                        .scheme("bearer")
                        .bearerFormat("JWT")
                        .description("Enter your JWT access token")));
    }
}
