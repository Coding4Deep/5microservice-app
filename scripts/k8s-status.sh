#!/bin/bash

echo "=== Kubernetes Deployment Status ==="
echo "Minikube IP: $(minikube ip)"
echo

echo "=== Pods Status ==="
kubectl get pods
echo

echo "=== Services ==="
kubectl get services
echo

echo "=== Access URLs ==="
echo "Frontend: http://$(minikube ip):30000"
echo "User Service: http://$(minikube ip):30904"
echo "User Service Health: http://$(minikube ip):30904/health"
echo

echo "=== Test Commands ==="
echo "# Register user:"
echo "curl -X POST http://$(minikube ip):30904/api/users/register -H 'Content-Type: application/json' -d '{\"username\":\"testuser\",\"email\":\"test@example.com\",\"password\":\"password123\"}'"
echo
echo "# Login user:"
echo "curl -X POST http://$(minikube ip):30904/api/users/login -H 'Content-Type: application/json' -d '{\"username\":\"testuser\",\"password\":\"password123\"}'"
echo

echo "=== Useful Commands ==="
echo "# View logs:"
echo "kubectl logs -f deployment/frontend"
echo "kubectl logs -f deployment/user-service"
echo "kubectl logs -f deployment/postgres"
echo
echo "# Scale services:"
echo "kubectl scale deployment frontend --replicas=2"
echo "kubectl scale deployment user-service --replicas=2"
echo
echo "# Delete deployment:"
echo "kubectl delete -f k8s/"
