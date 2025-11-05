package com.chat.userservice.metrics;

import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.Gauge;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Timer;
import io.micrometer.core.instrument.Tags;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import jakarta.annotation.PostConstruct;
import javax.sql.DataSource;
import java.lang.management.ManagementFactory;
import java.lang.management.MemoryMXBean;
import java.lang.management.OperatingSystemMXBean;
import java.sql.Connection;
import java.sql.Statement;
import java.time.Instant;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.HashMap;
import java.util.Map;

@Component
public class MetricsService {
    private final long startTime = System.currentTimeMillis();
    private long requestsTotal = 0;
    private long errorsTotal = 0;
    private long usersRegistered = 0;
    private final Map<String, Long> requestsByRoute = new HashMap<>();
    private final Deque<Long> latenciesMs = new ArrayDeque<>();

    @Autowired
    private DataSource dataSource;

    // Deployment metadata
    @Value("${SERVICE_VERSION:1.0.0}")
    private String serviceVersion;

    @Value("${GIT_COMMIT_SHA:unknown}")
    private String gitCommitSha;

    @Value("${INSTANCE_ID:${HOSTNAME:localhost}}")
    private String instanceId;

    @Value("${ENVIRONMENT:development}")
    private String environment;

    // Prometheus metrics with deployment labels
    private Counter httpRequestsTotal;
    private Timer httpRequestDuration;
    private Counter serviceErrorsTotal;
    private Counter businessUserRegistrationsTotal;
    private Counter businessUserLoginsTotal;

    private Tags deploymentTags;
    private final MeterRegistry meterRegistry;

    public MetricsService(MeterRegistry meterRegistry) {
        this.meterRegistry = meterRegistry;
    }

    @PostConstruct
    public synchronized void initializeMetrics() {
        this.deploymentTags = Tags.of(
            "service", "user-service",
            "version", serviceVersion != null ? serviceVersion : "1.0.0",
            "commit_sha", gitCommitSha != null ? gitCommitSha : "unknown",
            "instance_id", instanceId != null ? instanceId : "localhost",
            "environment", environment != null ? environment : "development"
        );

        this.httpRequestsTotal = Counter.builder("http_requests_total")
                .description("Total number of HTTP requests")
                .tags(deploymentTags)
                .register(meterRegistry);

        this.httpRequestDuration = Timer.builder("http_request_duration_seconds")
                .description("HTTP request duration in seconds")
                .publishPercentileHistogram()
                .tags(deploymentTags)
                .register(meterRegistry);

        this.serviceErrorsTotal = Counter.builder("service_errors_total")
                .description("Total number of service errors")
                .tags(deploymentTags)
                .register(meterRegistry);

        this.businessUserRegistrationsTotal = Counter.builder("business_user_registrations_total")
                .description("Total number of user registrations")
                .tags(deploymentTags)
                .register(meterRegistry);

        this.businessUserLoginsTotal = Counter.builder("business_user_logins_total")
                .description("Total number of user logins")
                .tags(deploymentTags)
                .register(meterRegistry);
    }

    public synchronized void recordRequest(String route, long durationMs, int status) {
        requestsTotal++;
        requestsByRoute.merge(route, 1L, Long::sum);
        latenciesMs.addLast(durationMs);
        if (latenciesMs.size() > 500) latenciesMs.removeFirst();
        if (status >= 500) errorsTotal++;

        // Extract method and path from route (e.g., "GET /api/users" -> method="GET", route="/api/users")
        String[] parts = route.split(" ", 2);
        String method = parts.length > 0 ? parts[0] : "UNKNOWN";
        String path = parts.length > 1 ? parts[1] : route;

        // Update Prometheus metrics with method and route labels
        Counter.builder("http_requests_total")
            .description("Total number of HTTP requests")
            .tags(Tags.concat(deploymentTags, Tags.of("method", method, "route", path)))
            .register(meterRegistry)
            .increment();

        Timer.builder("http_request_duration_seconds")
            .description("HTTP request duration in seconds")
            .publishPercentileHistogram()
            .tags(Tags.concat(deploymentTags, Tags.of("method", method, "route", path)))
            .register(meterRegistry)
            .record(durationMs, java.util.concurrent.TimeUnit.MILLISECONDS);

        if (status >= 400) {
            Counter.builder("service_errors_total")
                .description("Total number of service errors")
                .tags(Tags.concat(deploymentTags, Tags.of("method", method, "route", path)))
                .register(meterRegistry)
                .increment();
        }
    }

    public synchronized void recordUserRegistration() {
        usersRegistered++;
        businessUserRegistrationsTotal.increment();
    }

    public synchronized void recordUserLogin() {
        businessUserLoginsTotal.increment();
    }

    public synchronized void recordError(String errorType) {
        errorsTotal++;
        serviceErrorsTotal.increment();
    }

    public synchronized Map<String, Object> snapshot(String serviceName) {
        var arr = latenciesMs.stream().sorted().toList();
        long count = arr.size();
        long min = count > 0 ? arr.get(0) : 0;
        long max = count > 0 ? arr.get((int)count-1) : 0;
        long sum = arr.stream().mapToLong(Long::longValue).sum();
        long p50 = count > 0 ? arr.get(Math.min((int)count-1, Math.max(0, (int)Math.floor(count*0.5)))) : 0;
        long p95 = count > 0 ? arr.get(Math.min((int)count-1, Math.max(0, (int)Math.floor(count*0.95)))) : 0;
        long p99 = count > 0 ? arr.get(Math.min((int)count-1, Math.max(0, (int)Math.floor(count*0.99)))) : 0;

        // System metrics
        OperatingSystemMXBean osBean = ManagementFactory.getOperatingSystemMXBean();
        MemoryMXBean memoryBean = ManagementFactory.getMemoryMXBean();

        // Database status
        String dbStatus = "connected";
        try (Connection conn = dataSource.getConnection();
             Statement stmt = conn.createStatement()) {
            stmt.execute("SELECT 1");
        } catch (Exception e) {
            dbStatus = "disconnected";
        }

        Map<String, Object> out = new HashMap<>();
        out.put("service", serviceName);
        out.put("status", dbStatus.equals("connected") ? "healthy" : "degraded");
        out.put("uptimeMs", System.currentTimeMillis() - startTime);
        out.put("requestsTotal", requestsTotal);
        out.put("requestsByRoute", new HashMap<>(requestsByRoute));
        out.put("errorsTotal", errorsTotal);
        out.put("errorRate", requestsTotal > 0 ? Math.round((double)errorsTotal / requestsTotal * 100 * 100.0) / 100.0 : 0);

        Map<String, Object> latency = new HashMap<>();
        latency.put("count", count);
        latency.put("min", min);
        latency.put("p50", p50);
        latency.put("p95", p95);
        latency.put("p99", p99);
        latency.put("max", max);
        latency.put("avg", count > 0 ? Math.round((double)sum / count * 100.0) / 100.0 : 0);
        out.put("latency", latency);

        Map<String, Object> resources = new HashMap<>();
        resources.put("memoryMB", Math.round(memoryBean.getHeapMemoryUsage().getUsed() / 1024.0 / 1024.0 * 100.0) / 100.0);
        resources.put("availableProcessors", osBean.getAvailableProcessors());
        out.put("resources", resources);

        Map<String, Object> dependencies = new HashMap<>();
        Map<String, Object> database = new HashMap<>();
        database.put("status", dbStatus);
        database.put("type", "PostgreSQL");
        dependencies.put("database", database);
        out.put("dependencies", dependencies);

        Map<String, Object> business = new HashMap<>();
        business.put("userRegistrations", requestsByRoute.getOrDefault("POST /api/users/register", 0L));
        business.put("userLogins", requestsByRoute.getOrDefault("POST /api/users/login", 0L));
        business.put("profileViews", requestsByRoute.getOrDefault("GET /api/users", 0L));
        out.put("business", business);

        Map<String, Object> deployment = new HashMap<>();
        deployment.put("service", "user-service");
        deployment.put("version", serviceVersion);
        deployment.put("commit_sha", gitCommitSha);
        deployment.put("instance_id", instanceId);
        deployment.put("environment", environment);
        out.put("deployment", deployment);

        out.put("timestamp", Instant.now().toString());
        return out;
    }
}
