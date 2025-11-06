#!/bin/bash

# Load environment variables if .env exists
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

# Build if needed
if [ ! -f "./loadgen" ]; then
    echo "Building load generator..."
    go build -o loadgen ./cmd/loadgen
fi

# Check if web mode requested
if [ "$1" = "web" ]; then
    echo "🌐 Starting Load Generator Web Interface"
    echo "  Access: http://localhost:${WEB_PORT:-3002}"
    echo "  Metrics: http://localhost:${METRICS_PORT:-9090}/metrics"
    echo ""
    ./loadgen --web
    exit 0
fi

# CLI mode - Default values
USERS=${1:-10}
DURATION=${2:-2m}
RAMP=${3:-5/s}

# echo "🚀 Starting Load Generator (CLI Mode)"
# echo "  Users: $USERS"
# echo "  Duration: $DURATION" 
# echo "  Ramp-up: $RAMP"
# echo "  Web Port: ${WEB_PORT:-3002}"
# echo "  Metrics Port: ${METRICS_PORT:-9090}"
# echo "  Services: ${USER_SERVICE_URL:-http://localhost:8080}, ${CHAT_SERVICE_URL:-http://localhost:3001}, ${POSTS_SERVICE_URL:-http://localhost:8083}, ${PROFILE_SERVICE_URL:-http://localhost:8081}"
# echo ""

./loadgen --users $USERS --duration $DURATION --ramp $RAMP
