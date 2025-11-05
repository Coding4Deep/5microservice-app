# Chat Microservices Application

Production-ready microservices chat application with real-time messaging, user profiles, image sharing, JWT authentication, distributed tracing, and comprehensive monitoring built with Spring Boot, Node.js, FastAPI, Go, and React.

## 🚀 Features

- ✅ **User Management**: Registration, authentication, and JWT-based security
- ✅ **Real-time Chat**: Public and private messaging with WebSocket support
- ✅ **Image Sharing**: Post images with automatic resizing and preview
- ✅ **User Profiles**: Profile management with image upload capabilities
- ✅ **Service Monitoring**: Health checks, metrics, and status dashboard
- ✅ **Distributed Tracing**: OpenTelemetry integration with Jaeger
- ✅ **Code Quality**: Comprehensive linting, static analysis, and security scanning
- ✅ **Online Users**: Real-time tracking of active users

## 🏗️ Architecture

```
Frontend (React) ──┐
                   ├─── User Service (Spring Boot) ──── PostgreSQL
                   ├─── Chat Service (Node.js) ────────── MongoDB, Redis, Kafka  
                   ├─── Profile Service (FastAPI) ─────── PostgreSQL, Redis
                   └─── Posts Service (Go) ─────────────── PostgreSQL, MongoDB, Redis
```

## 🛠️ Technology Stack

| Service | Technology | Database | Purpose |
|---------|------------|----------|---------|
| **Frontend** | React 18 | - | Web Interface |
| **User Service** | Spring Boot 3.1 | PostgreSQL | Authentication & User Management |
| **Chat Service** | Node.js 18 | MongoDB, Redis, Kafka | Real-time Messaging |
| **Posts Service** | Go 1.21 | PostgreSQL, MongoDB, Redis | Image Sharing |
| **Profile Service** | Python FastAPI | PostgreSQL, Redis | User Profiles |

### Infrastructure Components

| Component | Purpose | Port |
|-----------|---------|------|
| **PostgreSQL** | Primary Database | 5432 |
| **MongoDB** | Document Storage | 27017 |
| **Redis** | Caching & Sessions | 6379 |
| **Kafka** | Message Queue | 9092 |
| **Jaeger** | Distributed Tracing | 16686 |

## 🚀 Quick Start

### Prerequisites

- Docker & Docker Compose
- Git

### Installation & Setup

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd chat-microservices-app
   ```

2. **Start all services**
   ```bash
   docker compose up -d
   ```

3. **Access the application**
   - **Web App**: http://localhost:3000
   - **Service Dashboard**: http://localhost:3000/services
   - **Jaeger Tracing**: http://localhost:16686

4. **Verify services are running**
   ```bash
   # Check all service health
   curl http://localhost:8080/health  # User Service
   curl http://localhost:3001/health  # Chat Service
   curl http://localhost:8081/health  # Profile Service
   curl http://localhost:8083/health  # Posts Service
   ```

## 📊 Service Endpoints

| Service | Port | Health Check | Metrics |
|---------|------|--------------|---------|
| Frontend | 3000 | - | - |
| User Service | 8080 | `/health` | `/metrics` |
| Chat Service | 3001 | `/health` | `/metrics` |
| Profile Service | 8081 | `/health` | `/metrics` |
| Posts Service | 8083 | `/health` | `/metrics` |

## 🧪 Testing the Application

### API Testing with curl

```bash
# Register a new user
curl -X POST http://localhost:8080/api/users/register \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","email":"user@example.com","password":"password123"}'

# Login
curl -X POST http://localhost:8080/api/users/login \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","password":"password123"}'

# Get chat messages
curl http://localhost:3001/api/messages

# Get posts
curl http://localhost:8083/api/posts

# Check all service health
for port in 8080 3001 8081 8083; do 
  echo "=== Service on port $port ==="
  curl -s http://localhost:$port/health | jq .
done
```

### Web Interface Testing

1. Open http://localhost:3000
2. Register a new account
3. Login with your credentials
4. Test real-time chat functionality
5. Upload and share images
6. Update your profile
7. Monitor services at `/services` page

## 🔧 Development

### Running Individual Services

```bash
# User Service (Java/Spring Boot)
cd user-service
mvn spring-boot:run

# Chat Service (Node.js)
cd chat-service
npm install && npm start

# Profile Service (Python/FastAPI)
cd profile-service
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# Posts Service (Go)
cd posts-service
go run main.go

# Frontend (React)
cd frontend
npm install && npm start
```

### Code Quality & Linting

**Run all linting checks:**
```bash
./lint-all.sh
```

**Individual service linting:**
```bash
# Java (Checkstyle + SpotBugs)
cd user-service && mvn checkstyle:check && mvn spotbugs:check

# Node.js (ESLint)
cd chat-service && npm run lint

# Python (Flake8)
cd profile-service && flake8 app/

# Go (vet + fmt)
cd posts-service && go vet ./... && go fmt ./...

# React (ESLint)
cd frontend && npm run lint
```

### Security Scanning

**Dependency vulnerability scanning:**
```bash
# Java (OWASP Dependency Check)
cd user-service && mvn org.owasp:dependency-check-maven:check

# Node.js (npm audit)
cd chat-service && npm audit

# Python (Safety)
cd profile-service && safety check

# Go (govulncheck)
cd posts-service && govulncheck ./...
```

## 📈 Monitoring & Observability

### Health Monitoring
- **Service Status Dashboard**: http://localhost:3000/services
- **Individual Health Checks**: `GET /{service}/health`
- **Metrics Endpoints**: `GET /{service}/metrics`

### Distributed Tracing
- **Jaeger UI**: http://localhost:16686
- **Trace Generation**: Use the application normally - traces are automatically generated
- **Cross-Service Correlation**: View how requests flow between services

### Logging
- **Structured JSON Logs**: Each service writes logs to `logs/` directory
- **Centralized Correlation**: Trace IDs included in all log entries

## 🚢 Deployment

### Production Deployment

1. **Build production images**
   ```bash
   docker compose build
   ```

2. **Deploy to your platform**
   ```bash
   # Example for AWS ECS, Kubernetes, etc.
   # Update docker-compose.yml with your production configuration
   docker compose -f docker-compose.prod.yml up -d
   ```

3. **Environment Configuration**
   ```bash
   # Update service URLs for your environment
   ./generate-config.sh \
     https://user-service.yourapp.com \
     https://chat-service.yourapp.com \
     https://posts-service.yourapp.com \
     https://profile-service.yourapp.com
   ```

### Frontend Deployment (S3 Example)

```bash
cd frontend
npm run build
aws s3 sync build/ s3://your-bucket-name --delete
```

## 🔧 Configuration

### Environment Variables

Each service supports environment configuration:

- `CORS_ORIGINS`: Allowed CORS origins (default: `*`)
- `LOG_DIR`: Directory for log files
- `SERVICE_NAME`: Service identifier for logs/metrics
- `DATABASE_URL`: Database connection string
- `REDIS_URL`: Redis connection string

### Example Environment Files

Check `env.example` files in each service directory for complete configuration options.

## 🧪 Testing

### Unit Tests & Coverage

```bash
# User Service (Java/JUnit)
cd user-service && mvn test jacoco:report

# Chat Service (Node.js/Jest)
cd chat-service && npm test -- --coverage

# Profile Service (Python)
cd profile-service && python -m pytest test/ --cov=app

# Posts Service (Go)
cd posts-service && go test -v -cover ./...

# Frontend (React/Jest)
cd frontend && npm test -- --coverage --watchAll=false
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Run linting and tests (`./lint-all.sh`)
4. Commit your changes (`git commit -m 'Add amazing feature'`)
5. Push to the branch (`git push origin feature/amazing-feature`)
6. Open a Pull Request

### Code Quality Standards

- All code must pass linting checks
- Security vulnerabilities must be addressed
- Unit tests required for new features
- Documentation updates for API changes

## 📝 API Documentation

### User Service (Port 8080)
- `POST /api/users/register` - User registration
- `POST /api/users/login` - User authentication
- `GET /health` - Health check
- `GET /metrics` - Service metrics

### Chat Service (Port 3001)
- `GET /api/messages` - Get chat messages
- `POST /api/messages` - Send message
- `WebSocket /socket.io` - Real-time messaging
- `GET /health` - Health check

### Profile Service (Port 8081)
- `GET /api/profile/{userId}` - Get user profile
- `PUT /api/profile/{userId}` - Update profile
- `POST /api/profile/{userId}/image` - Upload profile image
- `GET /health` - Health check

### Posts Service (Port 8083)
- `GET /api/posts` - Get all posts
- `POST /api/posts` - Create new post
- `POST /api/posts/{id}/like` - Like/unlike post
- `GET /api/images/{imageId}` - Get image
- `GET /health` - Health check

## 🐛 Troubleshooting

### Common Issues

1. **Port conflicts**: Ensure ports 3000, 3001, 8080-8083, 5432, 27017, 6379, 9092 are available
2. **Docker issues**: Run `docker compose down` then `docker compose up -d`
3. **Database connection issues**: Check if PostgreSQL/MongoDB containers are running
4. **CORS errors**: Verify `CORS_ORIGINS` environment variable
5. **Service startup failures**: Check logs with `docker compose logs [service-name]`

### Debug Commands

```bash
# View service logs
docker compose logs -f [service-name]

# Check container status
docker compose ps

# Restart specific service
docker compose restart [service-name]

# Clean restart
docker compose down && docker compose up -d
```



## 🌟 Acknowledgments

- Built with modern microservices architecture principles
- Implements enterprise-grade security and monitoring
- Follows industry best practices for code quality and testing
- Designed for scalability and production deployment

---

**Ready for production! 🚀**

For questions or support, please open an issue in the repository.
