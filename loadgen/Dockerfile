FROM golang:1.21-alpine AS builder

WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o loadgen ./cmd/loadgen

FROM alpine:latest
RUN apk --no-cache add ca-certificates
WORKDIR /root/

COPY --from=builder /app/loadgen .
COPY --from=builder /app/configs ./configs

EXPOSE 9090

CMD ["./loadgen"]
