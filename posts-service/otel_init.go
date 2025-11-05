package main

import (
	"context"
	"log"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc"
	"go.opentelemetry.io/otel/propagation"
	"go.opentelemetry.io/otel/sdk/resource"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
	semconv "go.opentelemetry.io/otel/semconv/v1.17.0"
	"go.opentelemetry.io/otel/trace"
)

var tracer trace.Tracer

func initTracing() {
	defer func() {
		if r := recover(); r != nil {
			log.Printf("Failed to initialize tracing: %v", r)
		}
	}()

	ctx := context.Background()

	// Create OTLP exporter
	exporter, err := otlptracegrpc.New(ctx,
		otlptracegrpc.WithEndpoint("jaeger:4317"),
		otlptracegrpc.WithInsecure(),
	)
	if err != nil {
		log.Printf("Failed to create OTLP exporter: %v", err)
		return
	}

	// Create resource
	res, err := resource.New(ctx,
		resource.WithAttributes(
			semconv.ServiceName("posts-service"),
			semconv.ServiceVersion("1.0.0"),
		),
	)
	if err != nil {
		log.Printf("Failed to create resource: %v", err)
		return
	}

	// Create tracer provider
	tp := sdktrace.NewTracerProvider(
		sdktrace.WithBatcher(exporter),
		sdktrace.WithResource(res),
	)

	// Set global tracer provider
	otel.SetTracerProvider(tp)
	otel.SetTextMapPropagator(propagation.TraceContext{})

	// Get tracer
	tracer = otel.Tracer("posts-service")

	log.Println("OpenTelemetry initialized successfully")
}

func getTracer() trace.Tracer {
	if tracer == nil {
		return otel.Tracer("posts-service")
	}
	return tracer
}

func createSpan(ctx context.Context, name string) (context.Context, trace.Span) {
	defer func() {
		if r := recover(); r != nil {
			log.Printf("Failed to create span: %v", r)
		}
	}()

	if tracer == nil {
		return ctx, trace.SpanFromContext(ctx)
	}

	return tracer.Start(ctx, name)
}
