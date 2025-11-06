#!/bin/bash

echo "🎯 Load Generator Demo"
echo "====================="

cd /home/vagrant/web-chat/loadgen

echo "Choose mode:"
echo "1. CLI Mode (run test immediately)"
echo "2. Web Interface Mode (control via browser)"
echo ""

read -p "Enter choice (1 or 2): " choice

case $choice in
    1)
        echo "🚀 Running CLI Demo - 5 users for 30 seconds..."
        ./run.sh 5 30s 2/s
        echo ""
        echo "✅ CLI Demo completed! Check your services:"
        echo "  📝 Posts: curl http://localhost:8083/api/posts | jq '.[0:2]'"
        echo "  💬 Chat: curl http://localhost:3001/api/messages | jq '.[0:2]'"
        ;;
    2)
        echo "🌐 Starting Web Interface..."
        echo "  Open: http://localhost:8080"
        echo "  Press Ctrl+C to stop"
        echo ""
        ./run.sh web
        ;;
    *)
        echo "Invalid choice. Use 1 or 2."
        exit 1
        ;;
esac
