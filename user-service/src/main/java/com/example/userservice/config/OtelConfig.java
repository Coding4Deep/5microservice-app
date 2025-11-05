package com.example.userservice.config;

import io.opentelemetry.api.OpenTelemetry;
import io.opentelemetry.api.trace.Tracer;
import io.opentelemetry.exporter.otlp.trace.OtlpGrpcSpanExporter;
import io.opentelemetry.sdk.OpenTelemetrySdk;
import io.opentelemetry.sdk.resources.Resource;
import io.opentelemetry.sdk.trace.SdkTracerProvider;
import io.opentelemetry.semconv.resource.attributes.ResourceAttributes;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class OtelConfig {

    @Value("${otel.exporter.otlp.endpoint:http://jaeger:4317}")
    private String otlpEndpoint;

    @Value("${otel.service.name:user-service}")
    private String serviceName;

    @Bean
    public OpenTelemetry openTelemetry() {
        try {
            Resource resource = Resource.getDefault()
                    .merge(Resource.builder()
                            .put(ResourceAttributes.SERVICE_NAME, serviceName)
                            .put(ResourceAttributes.SERVICE_VERSION, "1.0.0")
                            .build());

            SdkTracerProvider tracerProvider = SdkTracerProvider.builder()
                    .addSpanProcessor(io.opentelemetry.sdk.trace.export.BatchSpanProcessor.builder(
                            OtlpGrpcSpanExporter.builder()
                                    .setEndpoint(otlpEndpoint)
                                    .build())
                            .build())
                    .setResource(resource)
                    .build();

            return OpenTelemetrySdk.builder()
                    .setTracerProvider(tracerProvider)
                    .build();
        } catch (Exception e) {
            System.err.println("Failed to initialize OpenTelemetry: " + e.getMessage());
            return OpenTelemetry.noop();
        }
    }

    @Bean
    public Tracer tracer(OpenTelemetry openTelemetry) {
        return openTelemetry.getTracer(serviceName);
    }
}
