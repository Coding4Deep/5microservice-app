from fastapi import FastAPI, HTTPException, Depends, UploadFile, File, Form, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse, Response
from fastapi.security import HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from typing import Optional
import os
import uuid
import base64
import json
from PIL import Image
import io
import redis.asyncio as redis
import time
import logging
import psutil
from prometheus_client import Counter, Histogram, Gauge, generate_latest, CONTENT_TYPE_LATEST
import structlog
from pythonjsonlogger import jsonlogger

# OpenTelemetry imports
from opentelemetry import trace
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
from opentelemetry.sdk.resources import Resource
from opentelemetry.semconv.resource import ResourceAttributes
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
from opentelemetry.instrumentation.sqlalchemy import SQLAlchemyInstrumentor
from opentelemetry.instrumentation.redis import RedisInstrumentor
from opentelemetry.instrumentation.httpx import HTTPXClientInstrumentor

from app.db.database import get_db, engine
from app.models.profile import Base, UserProfile
from app.schemas.profile import ProfileResponse, ProfileUpdate, PasswordChange, ImageProcessRequest
from app.services.auth import verify_token, security

# Initialize OpenTelemetry
resource = Resource.create({
    ResourceAttributes.SERVICE_NAME: os.getenv("OTEL_SERVICE_NAME", "profile-service")
})

trace.set_tracer_provider(TracerProvider(resource=resource))
tracer = trace.get_tracer(__name__)

otlp_exporter = OTLPSpanExporter(
    endpoint=os.getenv("OTEL_EXPORTER_OTLP_ENDPOINT", "http://jaeger:4318/v1/traces")
)

span_processor = BatchSpanProcessor(otlp_exporter)
trace.get_tracer_provider().add_span_processor(span_processor)

# Create tables
Base.metadata.create_all(bind=engine)

SERVICE_NAME = os.getenv("SERVICE_NAME", "profile-service")

# Configure structured logging
structlog.configure(
    processors=[
        structlog.stdlib.filter_by_level,
        structlog.stdlib.add_logger_name,
        structlog.stdlib.add_log_level,
        structlog.stdlib.PositionalArgumentsFormatter(),
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
        structlog.processors.UnicodeDecoder(),
        structlog.processors.JSONRenderer()
    ],
    context_class=dict,
    logger_factory=structlog.stdlib.LoggerFactory(),
    wrapper_class=structlog.stdlib.BoundLogger,
    cache_logger_on_first_use=True,
)

# Setup JSON formatter for standard logging
logHandler = logging.StreamHandler()
formatter = jsonlogger.JsonFormatter(
    fmt='%(asctime)s %(name)s %(levelname)s %(message)s',
    datefmt='%Y-%m-%dT%H:%M:%S'
)
logHandler.setFormatter(formatter)
logger = logging.getLogger()
logger.addHandler(logHandler)
logger.setLevel(logging.INFO)

# Get structured logger
struct_logger = structlog.get_logger(SERVICE_NAME)

# Deployment metadata
SERVICE_VERSION = os.getenv("SERVICE_VERSION", "1.0.0")
GIT_COMMIT_SHA = os.getenv("GIT_COMMIT_SHA", "unknown")
INSTANCE_ID = os.getenv("HOSTNAME", "localhost")
ENVIRONMENT = os.getenv("ENVIRONMENT", "dev")

# Prometheus metrics
http_requests_total = Counter(
    'http_requests_total',
    'Total number of HTTP requests',
    ['method', 'endpoint', 'status', 'service', 'version', 'instance']
)

http_request_duration_seconds = Histogram(
    'http_request_duration_seconds',
    'HTTP request duration in seconds',
    ['method', 'endpoint', 'service', 'version', 'instance']
)

service_errors_total = Counter(
    'service_errors_total',
    'Total number of service errors',
    ['service', 'version', 'instance', 'error_type']
)

service_uptime_seconds = Gauge(
    'service_uptime_seconds',
    'Service uptime in seconds',
    ['service', 'version', 'instance']
)

business_profiles_updated_total = Counter(
    'business_profiles_updated_total',
    'Total number of profile updates',
    ['service', 'version', 'instance']
)

business_images_processed_total = Counter(
    'business_images_processed_total',
    'Total number of images processed',
    ['service', 'version', 'instance']
)


class JsonFormatter(logging.Formatter):
    def format(self, record):
        log = {
            "timestamp": time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime(record.created)),
            "service": SERVICE_NAME,
            "level": record.levelname.lower(),
            "message": record.getMessage(),
        }
        if hasattr(record, 'extra') and isinstance(record.extra, dict):
            log.update(record.extra)
        return json.dumps(log)


logger = logging.getLogger(SERVICE_NAME)
logger.setLevel(logging.INFO)
# Use console handler instead of file handler for now
console_handler = logging.StreamHandler()
console_handler.setFormatter(JsonFormatter())
logger.addHandler(console_handler)

app = FastAPI(title="Profile Service", version="1.0.0")

# Initialize OpenTelemetry instrumentations
FastAPIInstrumentor.instrument_app(app)
SQLAlchemyInstrumentor().instrument(engine=engine)
RedisInstrumentor().instrument()
HTTPXClientInstrumentor().instrument()

# Request correlation middleware


@app.middleware("http")
async def add_correlation_id(request: Request, call_next):
    request_id = request.headers.get("x-request-id", str(uuid.uuid4()))
    trace_id = request.headers.get("x-trace-id", str(uuid.uuid4()))

    # Add correlation context to structlog
    structlog.contextvars.clear_contextvars()
    structlog.contextvars.bind_contextvars(
        requestId=request_id,
        traceId=trace_id,
        method=request.method,
        path=request.url.path,
        service=SERVICE_NAME,
        instance=os.getenv("HOSTNAME", "localhost"),
        version=os.getenv("SERVICE_VERSION", "1.0.0"),
        environment=os.getenv("ENVIRONMENT", "development")
    )

    response = await call_next(request)
    response.headers["X-Request-ID"] = request_id
    response.headers["X-Trace-ID"] = trace_id
    return response

# CORS middleware
RAW_CORS_ORIGINS = os.getenv("CORS_ORIGINS", "*")
allow_origins = ["*"] if RAW_CORS_ORIGINS == "*" else [o.strip()
                                                       for o in RAW_CORS_ORIGINS.split(",")]
app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Redis connection
redis_client = None

metrics = {
    "service": SERVICE_NAME,
    "start_time": time.time(),
    "requests_total": 0,
    "requests_by_route": {},
    "errors_total": 0,
    "latencies_ms": [],  # last 500
}


@app.middleware("http")
async def log_and_measure(request: Request, call_next):
    start = time.time()
    path = request.url.path
    method = request.method
    metrics["requests_total"] += 1
    key = f"{method} {path}"
    metrics["requests_by_route"][key] = metrics["requests_by_route"].get(key, 0) + 1

    try:
        response = await call_next(request)

        # Update Prometheus metrics
        http_requests_total.labels(
            method=method,
            endpoint=path,
            status=str(response.status_code),
            service=SERVICE_NAME,
            version=SERVICE_VERSION,
            instance=INSTANCE_ID
        ).inc()

        dur_ms = int((time.time() - start) * 1000)
        http_request_duration_seconds.labels(
            method=method,
            endpoint=path,
            service=SERVICE_NAME,
            version=SERVICE_VERSION,
            instance=INSTANCE_ID
        ).observe((time.time() - start))

        if response.status_code >= 400:
            service_errors_total.labels(
                service=SERVICE_NAME,
                version=SERVICE_VERSION,
                instance=INSTANCE_ID,
                error_type="http_error"
            ).inc()

        return response
    except Exception as ex:
        metrics["errors_total"] += 1
        service_errors_total.labels(
            service=SERVICE_NAME,
            version=SERVICE_VERSION,
            instance=INSTANCE_ID,
            error_type="exception"
        ).inc()
        logger.error("request_failed", extra={
                     "extra": {"path": path, "method": method, "error": str(ex)}})
        raise
    finally:
        dur_ms = int((time.time() - start) * 1000)
        metrics["latencies_ms"].append(dur_ms)
        if len(metrics["latencies_ms"]) > 500:
            metrics["latencies_ms"].pop(0)

        # Update uptime
        service_uptime_seconds.labels(
            service=SERVICE_NAME,
            version=SERVICE_VERSION,
            instance=INSTANCE_ID
        ).set(time.time() - metrics["start_time"])

        logger.info("request_completed", extra={
                    "extra": {"path": path, "method": method, "durationMs": dur_ms}})


@app.on_event("startup")
async def startup_event():
    global redis_client
    redis_url = os.getenv("REDIS_URL", "redis://localhost:6379")
    redis_client = redis.from_url(redis_url, decode_responses=True)
    logger.info("startup", extra={"extra": {"message": "redis_client_initialized"}})


@app.on_event("shutdown")
async def shutdown_event():
    if redis_client:
        await redis_client.close()

# Create uploads directory
os.makedirs("uploads/profiles", exist_ok=True)
os.makedirs("uploads/temp", exist_ok=True)

# Serve static files
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")


@app.post("/api/profile/{username}/upload-temp-image")
async def upload_temp_image(
    username: str,
    image: UploadFile = File(...),
    current_user: str = Depends(verify_token)
):
    if current_user != username:
        raise HTTPException(status_code=403, detail="Can only upload to own profile")

    if not image.content_type.startswith('image/'):
        raise HTTPException(status_code=400, detail="File must be an image")

    # Read and validate image
    image_data = await image.read()
    try:
        pil_image = Image.open(io.BytesIO(image_data))
        pil_image.verify()  # Verify it's a valid image
        pil_image = Image.open(io.BytesIO(image_data))  # Reopen after verify
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid image file")

    # Convert to RGB if necessary
    if pil_image.mode != 'RGB':
        pil_image = pil_image.convert('RGB')

    # Generate temp ID and save to Redis
    temp_id = str(uuid.uuid4())

    # Save original image data to Redis (expires in 1 hour)
    image_buffer = io.BytesIO()
    pil_image.save(image_buffer, format='JPEG', quality=95)
    image_base64 = base64.b64encode(image_buffer.getvalue()).decode()

    await redis_client.setex(
        f"temp_image:{temp_id}",
        3600,  # 1 hour expiry
        json.dumps({
            "image_data": image_base64,
            "width": pil_image.width,
            "height": pil_image.height,
            "username": username
        })
    )

    return {
        "temp_id": temp_id,
        "width": pil_image.width,
        "height": pil_image.height,
        "preview_url": f"/api/temp-image/{temp_id}"
    }


@app.get("/api/temp-image/{temp_id}")
async def get_temp_image(temp_id: str):
    # Get image from Redis
    image_data = await redis_client.get(f"temp_image:{temp_id}")
    if not image_data:
        raise HTTPException(status_code=404, detail="Temp image not found or expired")

    data = json.loads(image_data)
    image_bytes = base64.b64decode(data["image_data"])

    return Response(content=image_bytes, media_type="image/jpeg")


@app.post("/api/profile/{username}/process-image")
async def process_and_save_image(
    username: str,
    request: ImageProcessRequest,
    current_user: str = Depends(verify_token),
    db: Session = Depends(get_db)
):
    if current_user != username:
        raise HTTPException(status_code=403, detail="Can only update own profile")

    # Get temp image from Redis
    image_data = await redis_client.get(f"temp_image:{request.temp_id}")
    if not image_data:
        raise HTTPException(status_code=404, detail="Temp image not found or expired")

    data = json.loads(image_data)
    if data["username"] != username:
        raise HTTPException(status_code=403, detail="Image belongs to different user")

    # Decode image
    image_bytes = base64.b64decode(data["image_data"])
    pil_image = Image.open(io.BytesIO(image_bytes))

    # Apply crop if specified
    if request.crop_x is not None and request.crop_y is not None:
        crop_box = (
            int(request.crop_x),
            int(request.crop_y),
            int(request.crop_x + request.crop_width),
            int(request.crop_y + request.crop_height)
        )
        pil_image = pil_image.crop(crop_box)

    # Resize to final size (300x300)
    final_size = (300, 300)
    pil_image = pil_image.resize(final_size, Image.Resampling.LANCZOS)

    # Save final image
    filename = f"{uuid.uuid4()}.jpg"
    filepath = f"uploads/profiles/{filename}"
    pil_image.save(filepath, "JPEG", quality=85)

    # Update profile in database
    profile = db.query(UserProfile).filter(UserProfile.username == username).first()
    if not profile:
        profile = UserProfile(username=username)
        db.add(profile)

    # Remove old profile picture
    if profile.profile_picture:
        old_path = profile.profile_picture.replace("/uploads/", "uploads/")
        if os.path.exists(old_path):
            os.remove(old_path)

    profile.profile_picture = f"/uploads/profiles/{filename}"
    db.commit()

    # Clean up temp image from Redis
    await redis_client.delete(f"temp_image:{request.temp_id}")

    # Cache profile data in Redis for 5 minutes
    profile_cache = {
        "username": profile.username,
        "bio": profile.bio,
        "profile_picture": profile.profile_picture,
        "updated_at": profile.updated_at.isoformat()
    }
    await redis_client.setex(f"profile:{username}", 300, json.dumps(profile_cache))

    # Update business metrics
    business_images_processed_total.labels(
        service=SERVICE_NAME,
        version=SERVICE_VERSION,
        instance=INSTANCE_ID
    ).inc()

    return {"message": "Profile picture updated successfully", "profile_picture": profile.profile_picture}


@app.get("/health")
async def health_check():
    return {"status": "OK", "service": SERVICE_NAME}


@app.get("/metrics")
async def metrics_endpoint():
    import psutil
    process = psutil.Process()
    mem_info = process.memory_info()

    # Database connection check
    db_status = "connected"
    try:
        from app.db.database import engine
        with engine.connect() as conn:
            conn.execute("SELECT 1")
    except:
        db_status = "disconnected"

    # Redis connection check
    redis_status = "connected"
    try:
        await redis_client.ping()
    except:
        redis_status = "disconnected"

    # Calculate latency stats
    arr = sorted(metrics["latencies_ms"]) if metrics["latencies_ms"] else []

    def pct(p):
        if not arr:
            return 0
        i = min(len(arr)-1, int(p*len(arr)))
        return arr[i]

    return {
        "service": SERVICE_NAME,
        "status": "healthy" if db_status == "connected" and redis_status == "connected" else "degraded",
        "uptimeMs": int((time.time() - metrics["start_time"]) * 1000),
        "requestsTotal": metrics["requests_total"],
        "requestsByRoute": metrics["requests_by_route"],
        "errorsTotal": metrics["errors_total"],
        "errorRate": round(metrics["errors_total"] / max(metrics["requests_total"], 1) * 100, 2),
        "latency": {
            "count": len(arr),
            "min": arr[0] if arr else 0,
            "p50": pct(0.5),
            "p95": pct(0.95),
            "p99": pct(0.99),
            "max": arr[-1] if arr else 0,
            "avg": round(sum(arr)/len(arr), 2) if arr else 0,
        },
        "resources": {
            "memoryMB": round(mem_info.rss / 1024 / 1024, 2),
            "cpuPercent": process.cpu_percent(),
            "openFiles": len(process.open_files()),
            "connections": len(process.connections()),
        },
        "dependencies": {
            "database": {"status": db_status, "type": "PostgreSQL"},
            "redis": {"status": redis_status, "type": "Redis"}
        },
        "business": {
            "profilesCreated": len(metrics["requests_by_route"].get("POST /api/profile", [])),
            "profileViews": metrics["requests_by_route"].get("GET /api/profile", 0),
            "imageUploads": metrics["requests_by_route"].get("POST /api/profile/{username}/upload-temp-image", 0)
        },
        "deployment": {
            "version": SERVICE_VERSION,
            "commit_sha": GIT_COMMIT_SHA,
            "instance_id": INSTANCE_ID,
            "environment": ENVIRONMENT
        },
        "timestamp": time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
    }


@app.get("/prometheus")
async def prometheus_metrics():
    return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)


@app.get("/api/profile/{username}", response_model=ProfileResponse)
async def get_profile(username: str, db: Session = Depends(get_db)):
    # Try to get from Redis cache first
    try:
        cached_profile = await redis_client.get(f"profile:{username}")
        if cached_profile:
            data = json.loads(cached_profile)
            # Ensure all required fields are present
            if all(key in data for key in ['username', 'created_at', 'updated_at']):
                return ProfileResponse(**data)
    except Exception as e:
        print(f"Redis cache error: {e}")

    # Get from database
    profile = db.query(UserProfile).filter(UserProfile.username == username).first()
    if not profile:
        # Create default profile if doesn't exist
        profile = UserProfile(username=username)
        db.add(profile)
        db.commit()
        db.refresh(profile)

    # Cache in Redis for 5 minutes
    try:
        profile_cache = {
            "username": profile.username,
            "bio": profile.bio or "",
            "profile_picture": profile.profile_picture,
            "created_at": profile.created_at.isoformat(),
            "updated_at": profile.updated_at.isoformat()
        }
        await redis_client.setex(f"profile:{username}", 300, json.dumps(profile_cache))
    except Exception as e:
        print(f"Redis cache set error: {e}")

    return ProfileResponse(
        username=profile.username,
        bio=profile.bio or "",
        profile_picture=profile.profile_picture,
        created_at=profile.created_at,
        updated_at=profile.updated_at
    )


@app.put("/api/profile/{username}")
async def update_profile(
    username: str,
    bio: Optional[str] = Form(None),
    current_user: str = Depends(verify_token),
    db: Session = Depends(get_db)
):
    if current_user != username:
        raise HTTPException(status_code=403, detail="Can only update own profile")

    profile = db.query(UserProfile).filter(UserProfile.username == username).first()
    if not profile:
        profile = UserProfile(username=username)
        db.add(profile)

    if bio is not None:
        profile.bio = bio

    db.commit()
    db.refresh(profile)

    # Invalidate cache
    await redis_client.delete(f"profile:{username}")

    # Update business metrics
    business_profiles_updated_total.labels(
        service=SERVICE_NAME,
        version=SERVICE_VERSION,
        instance=INSTANCE_ID
    ).inc()

    return {"message": "Profile updated successfully"}


@app.post("/api/profile/{username}/change-password")
async def change_password(
    username: str,
    password_data: PasswordChange,
    credentials: HTTPAuthorizationCredentials = Depends(security),
    current_user: str = Depends(verify_token),
    db: Session = Depends(get_db)
):
    if current_user != username:
        raise HTTPException(status_code=403, detail="Can only change own password")

    # Verify with user service and update password
    import httpx
    async with httpx.AsyncClient() as client:
        # First verify current password
        login_response = await client.post(
            "http://user-service:8080/api/users/login",
            json={"username": username, "password": password_data.current_password}
        )

        if login_response.status_code != 200:
            raise HTTPException(status_code=400, detail="Current password is incorrect")

        # Update password in user service with correct JWT token
        update_response = await client.put(
            f"http://user-service:8080/api/users/{username}/password",
            json={"newPassword": password_data.new_password},
            headers={"Authorization": f"Bearer {credentials.credentials}"}
        )

        if update_response.status_code == 200:
            return {"message": "Password changed successfully"}
        else:
            # If user service doesn't have password update endpoint, return info message
            return {"message": "Password change request processed. Please contact admin if issues persist."}


@app.get("/api/profiles/search")
async def search_profiles(q: str = "", db: Session = Depends(get_db)):
    profiles = db.query(UserProfile).filter(
        UserProfile.username.ilike(f"%{q}%")
    ).limit(10).all()

    return [
        {
            "username": p.username,
            "bio": p.bio,
            "profile_picture": p.profile_picture
        }
        for p in profiles
    ]

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
