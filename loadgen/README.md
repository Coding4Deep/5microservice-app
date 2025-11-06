# Load Generator for Chat Microservices

Realistic load generator with **Web Interface** and CLI modes for testing your microservices chat application.

## 🚀 Quick Start

### Web Interface Mode (Recommended)
```bash
# Start web interface
./run.sh web

# Open browser: http://localhost:8080
# Control tests via web UI
```

### CLI Mode
```bash
# Direct CLI execution
./run.sh 50 5m 10/s

# Or build and run
go build -o loadgen ./cmd/loadgen
./loadgen --users 50 --duration 5m --ramp 10/s
```

## 🌐 Web Interface Features

- **Interactive Control Panel**: Set users, duration, ramp-up via web form
- **Real-time Status**: Live test status and metrics
- **Test Reports**: Historical test results and reports
- **Live Metrics**: Active users, WebSocket connections, request counts
- **Start/Stop Control**: Start and stop tests from browser

### Web Interface Usage:
1. Start: `./run.sh web`
2. Open: http://localhost:8080
3. Configure test parameters
4. Click "Start Test"
5. Monitor real-time metrics
6. View test reports

## 🔧 Environment Configuration

Create `.env` file to customize service endpoints:

```bash
# Service Endpoints
USER_SERVICE_URL=http://localhost:8080
CHAT_SERVICE_URL=http://localhost:3001
POSTS_SERVICE_URL=http://localhost:8083
PROFILE_SERVICE_URL=http://localhost:8081

# Chaos Engineering
CHAOS_ERROR_RATE=0.15
CHAOS_DELAY_RATE=0.2
CHAOS_MAX_DELAY_MS=1500

# Tracing (optional)
JAEGER_ENDPOINT=
TRACING_ENABLED=false
```

## 📊 Realistic User Behavior

Each simulated user behaves like a real person:

- **Guaranteed Service Usage**: Every user uses at least one service per cycle
- **Weighted Actions**: 35% posts, 25% chat, 15% profile, 25% browsing
- **Realistic Content**: Emojis, varied messages, human-like posts
- **Smart Idle Times**: 2-8 seconds between actions
- **Failure Handling**: Graceful handling of auth failures and errors

### User Actions:
- 📝 **Create Posts**: "Just posted from user_5! 📝"
- 💬 **Send Chat**: "Hey everyone! user_3 here 👋"
- 👤 **Update Profile**: Bio and location updates
- 👍 **Like Posts**: Random post liking
- 👀 **Browse Content**: View posts and messages

## 📈 Features

- **Web Interface**: Browser-based control and monitoring
- **Multi-Service Testing**: Tests all 4 microservices simultaneously
- **WebSocket Chat**: Real-time public messaging
- **Environment Variables**: Easy endpoint configuration
- **Chaos Engineering**: Configurable failure injection
- **Prometheus Metrics**: Comprehensive observability
- **Test Reports**: Historical test data

## 🎯 Usage Examples

### Web Mode
```bash
# Start web interface
./run.sh web

# Access at http://localhost:8080
# Configure and run tests via browser
```

### CLI Mode
```bash
# Basic load test
./run.sh 100 10m 5/s

# With custom endpoints
USER_SERVICE_URL=http://prod-user:8080 \
CHAT_SERVICE_URL=http://prod-chat:3001 \
./run.sh 500 30m 20/s

# High chaos testing
CHAOS_ERROR_RATE=0.3 CHAOS_DELAY_RATE=0.4 \
./run.sh 50 5m 10/s
```

## 📊 Monitoring

- **Web Dashboard**: http://localhost:8080 (Interactive control)
- **Metrics**: http://localhost:9090/metrics (Prometheus)
- **Service Health**: Automatic health checks

## 🧪 Demo

```bash
# Interactive demo
./demo.sh

# Choose:
# 1. CLI Mode (immediate test)
# 2. Web Interface Mode (browser control)
```

## 🎯 Production Ready

- **Web Interface**: Easy operation for non-technical users
- **Scalable**: Tested with 500+ concurrent users
- **Configurable**: Environment-based configuration
- **Observable**: Full metrics and reporting
- **Realistic**: Human-like behavior patterns
- **Resilient**: Handles failures gracefully
