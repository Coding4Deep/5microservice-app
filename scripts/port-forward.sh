#!/bin/bash

ACTION=${1:-start}

case $ACTION in
  start)
    echo "Starting port forwarding..."
    
    # Kill existing port forwards
    pkill -f "kubectl port-forward" 2>/dev/null || true
    sleep 2
    
    # Start port forwarding
    kubectl port-forward service/frontend 3000:80 &
    FRONTEND_PID=$!
    
    kubectl port-forward service/user-service 8080:8080 &
    USER_SERVICE_PID=$!
    
    # Save PIDs
    echo $FRONTEND_PID > /tmp/frontend-pf.pid
    echo $USER_SERVICE_PID > /tmp/user-service-pf.pid
    
    echo "Port forwarding started:"
    echo "Frontend: http://localhost:3000 (PID: $FRONTEND_PID)"
    echo "User Service: http://localhost:8080 (PID: $USER_SERVICE_PID)"
    echo ""
    echo "Access from Windows host:"
    echo "Frontend: http://localhost:3000"
    echo "User Service: http://localhost:8080"
    echo ""
    echo "Run './port-forward.sh stop' to stop port forwarding"
    echo "Run './port-forward.sh status' to check status"
    
    # Wait for user input to keep running
    echo ""
    echo "Press Ctrl+C to stop port forwarding..."
    wait
    ;;
    
  stop)
    echo "Stopping port forwarding..."
    pkill -f "kubectl port-forward" 2>/dev/null || true
    rm -f /tmp/frontend-pf.pid /tmp/user-service-pf.pid
    echo "Port forwarding stopped."
    ;;
    
  status)
    echo "=== Port Forward Status ==="
    if pgrep -f "kubectl port-forward" > /dev/null; then
      echo "Port forwarding is running:"
      ps aux | grep "kubectl port-forward" | grep -v grep
      
      echo -e "\n=== Testing Services ==="
      timeout 3 curl -s -o /dev/null -w "Frontend (localhost:3000): HTTP %{http_code}\n" http://localhost:3000
      timeout 3 curl -s -o /dev/null -w "User Service (localhost:8080): HTTP %{http_code}\n" http://localhost:8080/health
    else
      echo "Port forwarding is not running."
      echo "Run './port-forward.sh start' to start port forwarding"
    fi
    ;;
    
  test)
    echo "=== Testing Services ==="
    echo "Frontend:"
    curl -s -o /dev/null -w "HTTP Status: %{http_code}\n" http://localhost:3000
    
    echo -e "\nUser Service Health:"
    curl -s http://localhost:8080/health | jq . 2>/dev/null || curl -s http://localhost:8080/health
    
    echo -e "\nRegister test user:"
    curl -s -X POST http://localhost:8080/api/users/register \
      -H 'Content-Type: application/json' \
      -d '{"username":"winuser","email":"win@example.com","password":"password123"}' | jq . 2>/dev/null || echo "Registration request sent"
    ;;
    
  *)
    echo "Usage: $0 {start|stop|status|test}"
    echo ""
    echo "Commands:"
    echo "  start  - Start port forwarding (blocks until Ctrl+C)"
    echo "  stop   - Stop all port forwarding"
    echo "  status - Check port forwarding status"
    echo "  test   - Test service connectivity"
    ;;
esac
