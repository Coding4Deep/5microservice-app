package com.chat.userservice.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.util.Arrays;

@Configuration
public class WebConfig {
    @Value("${CORS_ORIGINS:*}")
    private String corsOrigins;

    @Bean
    public WebMvcConfigurer corsConfigurer() {
        return new WebMvcConfigurer() {
            @Override
            public void addCorsMappings(final CorsRegistry registry) {
                if ("*".equals(corsOrigins)) {
                    registry.addMapping("/**")
                            .allowedOriginPatterns("*")
                            .allowedMethods("GET", "POST", "PUT",
                                    "DELETE", "OPTIONS")
                            .allowedHeaders("*")
                            .allowCredentials(true);
                } else {
                    String[] origins = Arrays.stream(corsOrigins.split(","))
                            .map(String::trim).toArray(String[]::new);
                    registry.addMapping("/**")
                            .allowedOrigins(origins)
                            .allowedMethods("GET", "POST", "PUT",
                                    "DELETE", "OPTIONS")
                            .allowedHeaders("*")
                            .allowCredentials(true);
                }
            }
        };
    }
}
