#!/bin/bash

echo "=== Testing Frontend Login Flow ==="

# Test frontend is accessible
echo "1. Testing frontend accessibility..."
FRONTEND_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000)
if [ "$FRONTEND_STATUS" = "200" ]; then
    echo "✅ Frontend is accessible at http://localhost:3000"
else
    echo "❌ Frontend not accessible (HTTP $FRONTEND_STATUS)"
    exit 1
fi

# Test user service
echo "2. Testing user service..."
USER_SERVICE_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/health)
if [ "$USER_SERVICE_STATUS" = "200" ]; then
    echo "✅ User service is healthy"
else
    echo "❌ User service not healthy (HTTP $USER_SERVICE_STATUS)"
    exit 1
fi

# Test chat service
echo "3. Testing chat service..."
CHAT_SERVICE_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/health)
if [ "$CHAT_SERVICE_STATUS" = "200" ]; then
    echo "✅ Chat service is healthy"
else
    echo "❌ Chat service not healthy (HTTP $CHAT_SERVICE_STATUS)"
    exit 1
fi

# Test profile service
echo "4. Testing profile service..."
PROFILE_SERVICE_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8081/health)
if [ "$PROFILE_SERVICE_STATUS" = "200" ]; then
    echo "✅ Profile service is healthy"
else
    echo "❌ Profile service not healthy (HTTP $PROFILE_SERVICE_STATUS)"
    exit 1
fi

# Test posts service
echo "5. Testing posts service..."
POSTS_SERVICE_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8083/health)
if [ "$POSTS_SERVICE_STATUS" = "200" ]; then
    echo "✅ Posts service is healthy"
else
    echo "❌ Posts service not healthy (HTTP $POSTS_SERVICE_STATUS)"
    exit 1
fi

# Test login flow
echo "6. Testing login API..."
LOGIN_RESPONSE=$(curl -s -X POST http://localhost:8080/api/users/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"testuser","password":"password123"}')

TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.token // empty')
if [ -n "$TOKEN" ] && [ "$TOKEN" != "null" ]; then
    echo "✅ Login successful, token received"
else
    echo "❌ Login failed or no token received"
    echo "Response: $LOGIN_RESPONSE"
    exit 1
fi

# Test dashboard API
echo "7. Testing dashboard API..."
DASHBOARD_RESPONSE=$(curl -s -H "Authorization: Bearer $TOKEN" \
  http://localhost:8080/api/users/dashboard)

TOTAL_USERS=$(echo "$DASHBOARD_RESPONSE" | jq -r '.totalUsers // empty')
if [ -n "$TOTAL_USERS" ] && [ "$TOTAL_USERS" != "null" ]; then
    echo "✅ Dashboard API working, found $TOTAL_USERS users"
else
    echo "❌ Dashboard API failed"
    echo "Response: $DASHBOARD_RESPONSE"
    exit 1
fi

echo ""
echo "🎉 All tests passed! Frontend should be working properly."
echo ""
echo "Next steps:"
echo "1. Open http://localhost:3000 in your browser"
echo "2. Login with: testuser / password123"
echo "3. You should be redirected to /dashboard"
echo ""
echo "If you still see a white screen:"
echo "1. Open browser developer tools (F12)"
echo "2. Check the Console tab for JavaScript errors"
echo "3. Check the Network tab for failed API calls"
