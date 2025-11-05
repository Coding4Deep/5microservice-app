# Multi-stage build
FROM python:3.11-slim AS builder
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir --user -r requirements.txt

FROM python:3.11-slim
RUN groupadd -r -g 1000 appuser && useradd -r -g appuser -u 1000 appuser
RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=builder /root/.local /home/appuser/.local
COPY --chown=appuser:appuser . .
RUN mkdir -p uploads/profiles uploads/temp logs && chown -R appuser:appuser . uploads logs
USER appuser
ENV PATH=/home/appuser/.local/bin:$PATH
ENV SERVICE_NAME=profile-service \
    CORS_ORIGINS=* \
    LOG_DIR=logs
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8000/health || exit 1
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
