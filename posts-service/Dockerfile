# Multi-stage build
FROM golang:1.21-alpine AS builder
RUN apk add --no-cache git ca-certificates tzdata
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -ldflags '-extldflags "-static"' -o posts-service .

FROM alpine:latest
RUN apk --no-cache add ca-certificates curl
RUN adduser -D -s /bin/sh appuser
WORKDIR /home/appuser
COPY --from=builder /app/posts-service .
RUN chown appuser:appuser posts-service
USER appuser
EXPOSE 8083
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8083/health || exit 1
ENTRYPOINT ["./posts-service"]
