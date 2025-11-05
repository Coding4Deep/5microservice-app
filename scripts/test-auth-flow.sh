#!/bin/bash

echo "=== Testing Authentication Flow with Service Downtime ==="

echo "1. Testing user registration..."
curl -X POST http://localhost:8080/api/users/register \
  -H "Content-Type: application/json" \
  -d '{"username":"testflow","email":"testflow@example.com","password":"password123"}' \
  -w "\nStatus: %{http_code}\n"

echo -e "\n2. Testing user login..."
LOGIN_RESPONSE=$(curl -s -X POST http://localhost:8080/api/users/login \
  -H "Content-Type: application/json" \
  -d '{"username":"testflow","password":"password123"}')

echo "$LOGIN_RESPONSE"
TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

echo -e "\n3. Testing token validation..."
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:8080/api/users/validate \
  -w "\nStatus: %{http_code}\n"

echo -e "\n4. Testing dashboard access..."
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:8080/api/users/dashboard \
  -w "\nStatus: %{http_code}\n" | head -5

echo -e "\n5. Simulating service downtime..."
echo "Stopping user service..."
docker compose stop user-service

echo -e "\n6. Testing frontend behavior during downtime..."
echo "Frontend should show service warning but not logout user"
echo "Access http://localhost:3000 in browser to test"

echo -e "\n7. Restarting service..."
sleep 5
docker compose start user-service

echo -e "\n8. Waiting for service to be ready..."
sleep 10

echo -e "\n9. Testing service recovery..."
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:8080/api/users/validate \
  -w "\nStatus: %{http_code}\n"

echo -e "\n=== Test Complete ==="
echo "Frontend URL: http://localhost:3000"
echo "Try logging in with: testflow / password123"
