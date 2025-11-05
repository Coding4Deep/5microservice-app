#!/bin/bash

echo "Running SpotBugs analysis on Java services..."

# User Service (Spring Boot)
echo "=== SpotBugs: User Service ==="
cd user-service
mvn compile com.github.spotbugs:spotbugs-maven-plugin:4.9.8.1:check
if [ $? -eq 0 ]; then
    echo "✅ User Service: SpotBugs passed"
else
    echo "❌ User Service: SpotBugs failed"
    exit 1
fi
cd ..

echo "🎉 All SpotBugs checks passed!"
