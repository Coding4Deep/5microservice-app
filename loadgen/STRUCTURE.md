# Load Generator Project Structure

```
loadgen/
├── cmd/loadgen/
│   └── main.go                 # CLI entry point
├── internal/
│   ├── behaviors/              # User behavior implementations
│   │   ├── auth.go            # Authentication (login/register)
│   │   ├── chat.go            # WebSocket chat behavior
│   │   └── posts.go           # Posts CRUD operations
│   ├── config/
│   │   └── config.go          # Configuration loader
│   ├── generator/
│   │   └── generator.go       # Main load test orchestrator
│   ├── user/
│   │   └── user.go            # Individual user simulation
│   ├── metrics/
│   │   └── metrics.go         # Prometheus metrics
│   ├── otel/
│   │   └── tracing.go         # OpenTelemetry setup
│   ├── dashboard/
│   │   └── dashboard.go       # HTML dashboard server
│   └── chaos/
│       └── chaos.go           # Chaos engineering features
├── configs/
│   └── config.yaml            # Service endpoints & settings
├── monitoring/
│   ├── prometheus.yml         # Prometheus config
│   ├── grafana-datasources.yml
│   └── grafana-dashboard.json
├── scripts/
│   ├── run.sh                 # Quick run script
│   └── test-scenarios.sh      # Multiple test scenarios
├── go.mod                     # Go module definition
├── go.sum                     # Go dependencies
├── Dockerfile                 # Container build
├── docker-compose.yml         # Full monitoring stack
└── README.md                  # Usage documentation
```

## Key Components

### 🎯 Core Features
- **Realistic User Simulation**: Each user follows human-like patterns
- **Multi-Service Testing**: Tests all 4 microservices simultaneously
- **WebSocket Support**: Real-time chat connections
- **Configurable Load**: Users, duration, ramp-up rates
- **Chaos Engineering**: Random errors and delays

### 📊 Observability
- **Prometheus Metrics**: Request rates, latency, errors
- **OpenTelemetry Tracing**: Distributed trace correlation
- **HTML Dashboard**: Real-time metrics visualization
- **Grafana Integration**: Advanced monitoring dashboards

### 🚀 Deployment
- **CLI Tool**: Direct execution with parameters
- **Docker Support**: Containerized deployment
- **Monitoring Stack**: Prometheus + Grafana included
- **Easy Scripts**: One-command execution

## Usage Examples

```bash
# Quick test
./loadgen --users 10 --duration 1m

# Production load test
./loadgen --users 500 --duration 30m --ramp 20/s

# With Docker
docker-compose up

# Multiple scenarios
./scripts/test-scenarios.sh
```
