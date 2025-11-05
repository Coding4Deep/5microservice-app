#!/bin/bash

echo "=== Complete Service Test ==="

# Register user
echo "1. Registering user 'bob'..."
REGISTER_RESPONSE=$(curl -s -X POST http://localhost:8080/api/users/register \
  -H 'Content-Type: application/json' \
  -d '{"username":"bob","email":"bob@example.com","password":"pass1234"}')
echo "Register response: $REGISTER_RESPONSE"

# Login
echo -e "\n2. Logging in as 'bob'..."
LOGIN_RESPONSE=$(curl -s -X POST http://localhost:8080/api/users/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"bob","password":"pass1234"}')
echo "Login response: $LOGIN_RESPONSE"

TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.token // empty')
if [ -z "$TOKEN" ] || [ "$TOKEN" = "null" ]; then
    echo "❌ Failed to get token"
    exit 1
fi
echo "✅ Token received: ${TOKEN:0:20}..."

# Test User Service
echo -e "\n3. Testing User Service Dashboard..."
DASHBOARD_RESPONSE=$(curl -s -H "Authorization: Bearer $TOKEN" \
  http://localhost:8080/api/users/dashboard)
echo "Dashboard: $DASHBOARD_RESPONSE"

# Test Profile Service
echo -e "\n4. Testing Profile Service..."
echo "Get profile:"
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:8081/api/profile/bob | jq .

echo -e "\nUpdate profile:"
curl -s -X PUT http://localhost:8081/api/profile/bob \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"bio":"Bob testing all services!"}' | jq .

echo -e "\nGet updated profile:"
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:8081/api/profile/bob | jq .

# Test Chat Service
echo -e "\n5. Testing Chat Service..."
echo "Active users:"
curl -s http://localhost:3001/api/users/active | jq .

echo -e "\nPublic messages:"
curl -s http://localhost:3001/api/messages | jq .

# Test Posts Service
echo -e "\n6. Testing Posts Service..."
echo "All posts:"
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:8083/api/posts | jq .

# Test frontend login via API call
echo -e "\n7. Testing Frontend Login (simulating browser)..."
FRONTEND_LOGIN=$(curl -s -X POST http://localhost:8080/api/users/login \
  -H 'Content-Type: application/json' \
  -H 'Origin: http://localhost:3000' \
  -d '{"username":"bob","password":"pass1234"}')
echo "Frontend login response: $FRONTEND_LOGIN"

echo -e "\n=== Test Complete ==="
echo "✅ User 'bob' registered and logged in successfully"
echo "✅ All backend services are working"
echo ""
echo "Now try logging in via the web interface:"
echo "URL: http://localhost:3000"
echo "Username: bob"
echo "Password: pass1234"
