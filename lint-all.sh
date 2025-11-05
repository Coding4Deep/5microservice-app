#!/bin/bash

echo "Running comprehensive code quality checks across all services..."

# Java (user-service) - Checkstyle
echo "=== Java Checkstyle: User Service ==="
cd user-service
mvn checkstyle:check
if [ $? -eq 0 ]; then
    echo "✅ User Service: Checkstyle passed"
else
    echo "❌ User Service: Checkstyle failed"
    exit 1
fi
cd ..

# Java (user-service) - SpotBugs
echo "=== Java SpotBugs: User Service ==="
cd user-service
mvn compile com.github.spotbugs:spotbugs-maven-plugin:4.9.8.1:check
if [ $? -eq 0 ]; then
    echo "✅ User Service: SpotBugs passed"
else
    echo "❌ User Service: SpotBugs failed"
    exit 1
fi
cd ..

# Node.js (chat-service) - ESLint
echo "=== Node.js ESLint: Chat Service ==="
cd chat-service
npm run lint
if [ $? -eq 0 ]; then
    echo "✅ Chat Service: ESLint passed"
else
    echo "❌ Chat Service: ESLint failed"
    exit 1
fi
cd ..

# Python (profile-service) - Flake8
echo "=== Python Flake8: Profile Service ==="
cd profile-service
python3 -m flake8 .
if [ $? -eq 0 ]; then
    echo "✅ Profile Service: Flake8 passed"
else
    echo "❌ Profile Service: Flake8 failed"
    exit 1
fi
cd ..

# Go (posts-service) - go vet
echo "=== Go vet: Posts Service ==="
cd posts-service
go vet ./...
if [ $? -eq 0 ]; then
    echo "✅ Posts Service: go vet passed"
else
    echo "❌ Posts Service: go vet failed"
    exit 1
fi
cd ..

# React (frontend) - ESLint
echo "=== React ESLint: Frontend ==="
cd frontend
npm run lint
if [ $? -eq 0 ]; then
    echo "✅ Frontend: ESLint passed"
else
    echo "❌ Frontend: ESLint failed"
    exit 1
fi
cd ..

echo "🎉 All linting and code quality checks passed!"
