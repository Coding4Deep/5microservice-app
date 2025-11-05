#!/bin/bash

# Cleanup script for all build artifacts and test results
echo "🧹 Cleaning all build artifacts and test results..."

# Java artifacts
echo "Cleaning Java artifacts..."
cd user-service 2>/dev/null && mvn clean -q && cd .. || true
find . -name "target" -type d -exec rm -rf {} + 2>/dev/null || true

# Node.js artifacts  
echo "Cleaning Node.js artifacts..."
find . -name "coverage" -type d -exec rm -rf {} + 2>/dev/null || true
find . -name ".eslintcache" -type f -delete 2>/dev/null || true
find . -name ".nyc_output" -type d -exec rm -rf {} + 2>/dev/null || true

# Python artifacts
echo "Cleaning Python artifacts..."
find . -name "__pycache__" -type d -exec rm -rf {} + 2>/dev/null || true
find . -name ".pytest_cache" -type d -exec rm -rf {} + 2>/dev/null || true
find . -name "*.egg-info" -type d -exec rm -rf {} + 2>/dev/null || true
find . -name ".coverage" -type f -delete 2>/dev/null || true
find . -name "htmlcov" -type d -exec rm -rf {} + 2>/dev/null || true

# Go artifacts
echo "Cleaning Go artifacts..."
find . -name "*.test" -type f -delete 2>/dev/null || true
find . -name "coverage.out" -type f -delete 2>/dev/null || true
find . -name "coverage.html" -type f -delete 2>/dev/null || true

# General artifacts
echo "Cleaning logs and temporary files..."
find . -name "*.log" -type f -delete 2>/dev/null || true
find . -name "logs" -type d -not -path "*/node_modules/*" -exec rm -rf {} + 2>/dev/null || true
find . -name "test-results" -type d -exec rm -rf {} + 2>/dev/null || true

echo "✅ Cleanup complete!"
