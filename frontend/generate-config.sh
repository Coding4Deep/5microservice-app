#!/bin/bash

# Generate runtime configuration for deployment
# Usage: ./generate-config.sh [user_service_url] [chat_service_url] [posts_service_url] [profile_service_url]

USER_SERVICE_URL=${1:-"http://localhost:8080"}
CHAT_SERVICE_URL=${2:-"http://localhost:3001"}
POSTS_SERVICE_URL=${3:-"http://localhost:8083"}
PROFILE_SERVICE_URL=${4:-"http://localhost:8081"}

cat > public/config.js << EOF
// Runtime configuration for frontend
window.APP_CONFIG = {
  USER_SERVICE_URL: '${USER_SERVICE_URL}',
  CHAT_SERVICE_URL: '${CHAT_SERVICE_URL}',
  POSTS_SERVICE_URL: '${POSTS_SERVICE_URL}',
  PROFILE_SERVICE_URL: '${PROFILE_SERVICE_URL}'
};
EOF

echo "Configuration generated with:"
echo "  USER_SERVICE_URL: ${USER_SERVICE_URL}"
echo "  CHAT_SERVICE_URL: ${CHAT_SERVICE_URL}"
echo "  POSTS_SERVICE_URL: ${POSTS_SERVICE_URL}"
echo "  PROFILE_SERVICE_URL: ${PROFILE_SERVICE_URL}"
