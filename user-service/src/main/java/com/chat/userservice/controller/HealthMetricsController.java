package com.chat.userservice.controller;

import com.chat.userservice.metrics.MetricsService;
import io.micrometer.core.instrument.MeterRegistry;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.filter.OncePerRequestFilter;
import io.micrometer.prometheus.PrometheusMeterRegistry;

import java.io.FileWriter;
import java.io.IOException;
import java.time.Instant;
import java.util.HashMap;
import java.util.Map;

@RestController
public class HealthMetricsController {

    @Value("${SERVICE_NAME:user-service}")
    private String serviceName;

    @Autowired
    private MetricsService metricsService;

    @Autowired
    private MeterRegistry meterRegistry;

    @GetMapping("/health")
    public ResponseEntity<Map<String, Object>> health() {
        Map<String, Object> out = new HashMap<>();
        out.put("status", "OK");
        out.put("service", serviceName);
        out.put("timestamp", Instant.now().toString());
        return ResponseEntity.ok(out);
    }

    @GetMapping("/metrics")
    public ResponseEntity<Map<String, Object>> metrics() {
        return ResponseEntity.ok(metricsService.snapshot(serviceName));
    }

    @GetMapping("/prometheus")
    public ResponseEntity<String> prometheus() {
        if (meterRegistry instanceof PrometheusMeterRegistry) {
            PrometheusMeterRegistry promRegistry = (PrometheusMeterRegistry) meterRegistry;
            return ResponseEntity.ok()
                    .header("Content-Type", "text/plain; version=0.0.4; charset=utf-8")
                    .body(promRegistry.scrape());
        }
        return ResponseEntity.status(302)
                .header("Location", "/actuator/prometheus")
                .body("Redirecting to /actuator/prometheus");
    }
}

@Component
class RequestLoggingFilter extends OncePerRequestFilter {

    @Value("${SERVICE_NAME:user-service}")
    private String serviceName;

    @Value("${LOG_DIR:./logs}")
    private String logDir;

    @Value("${SERVICE_VERSION:1.0.0}")
    private String serviceVersion;

    @Value("${GIT_COMMIT_SHA:unknown}")
    private String gitCommitSha;

    @Value("${INSTANCE_ID:${HOSTNAME:localhost}}")
    private String instanceId;

    @Value("${ENVIRONMENT:development}")
    private String environment;

    @Autowired
    private MetricsService metricsService;

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        long start = System.nanoTime();
        String traceId = request.getHeader("x-request-id");
        if (traceId == null) {
            traceId = java.util.UUID.randomUUID().toString().substring(0, 8);
        }
        response.setHeader("x-request-id", traceId);

        try {
            filterChain.doFilter(request, response);
        } finally {
            long durationMs = (System.nanoTime() - start) / 1_000_000;
            String route = request.getMethod() + " " + request.getRequestURI();
            metricsService.recordRequest(route, durationMs, response.getStatus());

            // Enhanced JSON log with deployment metadata
            Map<String, Object> log = new HashMap<>();
            log.put("timestamp", Instant.now().toString());
            log.put("service", serviceName);
            log.put("level", "info");
            log.put("traceId", traceId);
            log.put("message", "request_completed");
            log.put("method", request.getMethod());
            log.put("path", request.getRequestURI());
            log.put("status", response.getStatus());
            log.put("durationMs", durationMs);
            log.put("version", serviceVersion);
            log.put("commit_sha", gitCommitSha);
            log.put("instance_id", instanceId);
            log.put("environment", environment);

            new java.io.File(logDir).mkdirs();
            try (FileWriter fw = new FileWriter(logDir + "/app.log", true)) {
                fw.write(new com.fasterxml.jackson.databind.ObjectMapper().writeValueAsString(log));
                fw.write("\n");
            } catch (Exception ignored) {}
        }
    }
}
