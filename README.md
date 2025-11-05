# Chat Microservices Application

A production-ready microservices-based chat application with real-time messaging, user management, and image sharing.

## Features

- ✅ User Registration & Authentication (JWT)
- ✅ Real-time Chat (Public & Private)
- ✅ Image Posts with Preview & Resize
- ✅ User Profiles with Image Upload
- ✅ Service Status Dashboard
- ✅ Online Users Tracking

## Quick Start

```bash
# Build & run
docker compose build
docker compose up -d

# App URL
open http://localhost:3000

# Verify health
curl -s http://localhost:8080/health
curl -s http://localhost:3001/health
curl -s http://localhost:8081/health
curl -s http://localhost:8083/health

# Verify metrics
curl -s http://localhost:8080/metrics
curl -s http://localhost:3001/metrics
curl -s http://localhost:8081/metrics
curl -s http://localhost:8083/metrics
```

## Services

| Service | Port | Technology | Purpose | Database |
|---------|------|------------|---------|----------|
| Frontend | 3000 | React | Web Interface | - |
| User Service | 8080 | Spring Boot | Authentication | PostgreSQL |
| Chat Service | 3001 | Node.js | Real-time Chat | MongoDB, Redis, Kafka |
| Posts Service | 8083 | Go | Image Sharing | PostgreSQL, MongoDB, Redis |
| Profile Service | 8081 | Python FastAPI | User Profiles | PostgreSQL, Redis |

## Infrastructure

| Component | Port | Purpose | Used By |
|-----------|------|---------|---------|
| PostgreSQL | 5432 | Primary Database | User Service, Profile Service, Posts Service |
| MongoDB | 27017 | Document Storage | Chat Service, Posts Service |
| Redis | 6379 | Caching & Sessions | Chat Service, Profile Service, Posts Service |
| Kafka | 9092 | Message Queue | Chat Service |

## Service Status Dashboard

Access the service status dashboard at `/services` to monitor:
- Service health status (UP/DOWN)
- Database connections and usage
- Direct links to health checks (`/health`)
- Direct links to metrics (`/metrics`)

## Environment

Each service supports environment variables and includes an example file:

- chat-service: `env.example`
- profile-service: `env.example`
- posts-service: `env.example`
- user-service: `env.example`
- frontend: `env.example`

Key variables:
- `CORS_ORIGINS` (backend): comma-separated origins or `*`
- `LOG_DIR`: path where JSON logs are written
- `SERVICE_NAME`: logical name for logs/metrics

## Code Quality & Linting

All services have linting/code style checking configured:

### Running Linting Checks

**All Services:**
```bash
./lint-all.sh
```

**Individual Services:**

**Java (user-service):**
```bash
cd user-service && mvn checkstyle:check
```

**Node.js (chat-service):**
```bash
cd chat-service && npm run lint
```

**Python (profile-service):**
```bash
cd profile-service && python3 -m flake8 .
```

**Go (posts-service):**
```bash
cd posts-service && go vet ./... && go fmt ./...
```

**React (frontend):**
```bash
cd frontend && npm run lint
```

### Linting Configuration

- **Java**: Maven Checkstyle plugin with sun_checks.xml and custom suppressions
- **Node.js**: ESLint with recommended rules and auto-fix enabled
- **Python**: Flake8 with 88-character line length and common exclusions
- **Go**: Built-in `go vet` and `go fmt` tools
- **React**: ESLint via react-scripts with React-specific rules

### Status
- ✅ Java: Checkstyle passing with suppressions for documentation rules
- ✅ Java: SpotBugs passing with 0 bugs (security and quality analysis)
- ⚠️ Node.js: ESLint configured (warnings for unused variables)
- ⚠️ Python: Flake8 configured (30 formatting issues remain)
- ✅ Go: go vet passing, go fmt applied
- ⚠️ React: ESLint configured (React hooks dependency warnings)

## Testing

Each service has comprehensive tests located in their respective `test/` directories:

### Test Structure
```
├── user-service/test/          # Java/JUnit tests
├── chat-service/test/          # Node.js/Jest tests  
├── profile-service/test/       # Python tests
├── posts-service/test/         # Go tests
└── frontend/test/              # React/Jest tests
```

### Running Tests

**User Service (Spring Boot):**
```bash
cd user-service && mvn test jacoco:report
# Coverage report: target/site/jacoco/index.html
```

**Chat Service (Node.js):**
```bash
cd chat-service && npm test test/utils.test.js -- --coverage
```

**Profile Service (Python):**
```bash
cd profile-service && python3 test/test_utils.py
```

**Posts Service (Go):**
```bash
cd posts-service && go test -v -cover test/utils_test.go
```

**Frontend (React):**
```bash
cd frontend && npm install && npm test -- --coverage --watchAll=false
```

### Coverage Targets
- Target: 80%+ code coverage
- Current Status: See `TEST_COVERAGE_REPORT.md` for detailed results

## Observability

- Every backend exposes `/health` and `/metrics` (JSON)
- Metrics include request count, latency stats, errors, CPU/memory snapshot, and app-level counters
- Structured JSON logs written to each service's `logs/` directory
- **Distributed tracing** with OpenTelemetry and Jaeger

### Distributed Tracing

The application includes comprehensive OpenTelemetry distributed tracing across all services:

**Services with Tracing:**
- ✅ Frontend (React) - Auto-instrumentation for fetch/navigation + manual spans
- ✅ User Service (Spring Boot) - AOP-based method tracing
- ✅ Chat Service (Node.js) - Express middleware + manual spans  
- ✅ Profile Service (Python FastAPI) - ASGI middleware + manual spans
- ✅ Posts Service (Go) - Gin middleware + manual spans

**How to View Traces Locally:**

1. **Access Jaeger UI:**
   ```bash
   open http://localhost:16686
   ```

2. **Generate traces by using the application:**
   ```bash
   # Make API calls to generate traces
   curl -X POST http://localhost:8080/api/users/login \
     -H "Content-Type: application/json" \
     -d '{"username":"testuser","password":"password123"}'
   
   # Use the web app - traces are automatically generated
   open http://localhost:3000
   ```

3. **View traces in Jaeger:**
   - Select a service from the dropdown (e.g., "user-service")
   - Click "Find Traces" 
   - Click on any trace to see the distributed call flow
   - Observe how requests flow between services with timing information

**Trace Features:**
- W3C `traceparent` header propagation between services
- Automatic HTTP request/response instrumentation
- Manual spans for business logic (login, createPost, etc.)
- Error tracking and exception recording
- Cross-service correlation with trace IDs in logs

**OTLP Endpoints:**
- gRPC: `http://localhost:4317`
- HTTP: `http://localhost:4318/v1/traces`

## Deployment

### Local Development
```bash
# Start services
docker compose up -d

# Stop services
docker compose down
```

### Production Deployment

The application is designed to be deployed anywhere. For example, to deploy frontend to S3:

1. **Build the frontend:**
```bash
cd frontend
npm run build
```

2. **Configure backend URLs:**
```bash
# Generate config for your backend URLs
./generate-config.sh \
  https://api.yourapp.com/user \
  https://api.yourapp.com/chat \
  https://api.yourapp.com/posts \
  https://api.yourapp.com/profile
```

3. **Deploy to S3:**
```bash
aws s3 sync build/ s3://your-bucket-name --delete
```

4. **Deploy backend services** to your preferred platform (ECS, EKS, EC2, etc.)

### Environment Configuration

For different environments, update the service URLs:

**Development:**
```bash
./generate-config.sh \
  http://localhost:8080 \
  http://localhost:3001 \
  http://localhost:8083 \
  http://localhost:8081
```

**Production:**
```bash
./generate-config.sh \
  https://user-service.yourapp.com \
  https://chat-service.yourapp.com \
  https://posts-service.yourapp.com \
  https://profile-service.yourapp.com
```

## Testing via curl

```bash
# Register and login
curl -s -X POST http://localhost:8080/api/users/register -H 'Content-Type: application/json' -d '{"username":"alice","email":"alice@example.com","password":"pass1234"}'
curl -s -X POST http://localhost:8080/api/users/login -H 'Content-Type: application/json' -d '{"username":"alice","password":"pass1234"}'

# Public chat history
curl -s http://localhost:3001/api/messages

# Posts
curl -s http://localhost:8083/api/posts

# Health/metrics for all services
for port in 8080 3001 8081 8083; do 
  echo "=== Service on port $port ==="
  echo "Health:" 
  curl -s http://localhost:$port/health | jq .
  echo "Metrics:"
  curl -s http://localhost:$port/metrics | jq .
  echo
done
```

## API Examples

### User Registration
```bash
curl -X POST http://localhost:8080/api/users/register \
  -H "Content-Type: application/json" \
  -d '{"username":"newuser","email":"user@example.com","password":"password123"}'
```

### User Login
```bash
curl -X POST http://localhost:8080/api/users/login \
  -H "Content-Type: application/json" \
  -d '{"username":"newuser","password":"password123"}'
```

## Development

### Prerequisites
- Docker & Docker Compose

### Commands
```bash
# Start services
docker compose up -d

# View logs
docker logs web-chat-[service-name]-1

# Rebuild specific service
docker compose build [service-name]
docker compose up -d [service-name]

# Scale a service
docker compose up -d --scale chat-service=3
```

## Troubleshooting

1. **Port conflicts**: Ensure ports 3000, 3001, 8080-8083, 5432, 27017, 6379, 9092 are available
2. **Docker issues**: Run `docker compose down` then `docker compose up -d`
3. **Database issues**: Clear data with `docker volume prune`
4. **Service health**: Check `/services` page in the web app or use curl to check `/health` endpoints
5. **CORS issues**: Verify `CORS_ORIGINS` environment variable is set correctly

## Architecture

```
Frontend (React) ──┐
                   ├─── User Service (Spring Boot) ──── PostgreSQL
                   ├─── Chat Service (Node.js) ────────── MongoDB, Redis, Kafka  
                   ├─── Profile Service (FastAPI) ─────── PostgreSQL, Redis
                   └─── Posts Service (Go) ─────────────── PostgreSQL, MongoDB, Redis
```

---

**Ready for production! 🚀**
# microservice
# 5microservice-app
