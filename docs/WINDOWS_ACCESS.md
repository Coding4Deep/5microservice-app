# Windows Host Access Instructions

## ✅ Port Forwarding Active

Your Kubernetes services are now accessible from your Windows host via port forwarding:

### Access URLs (from Windows)
- **Frontend**: http://localhost:3000
- **User Service**: http://localhost:8080
- **User Service Health**: http://localhost:8080/health

### Management Commands

```bash
# Check status
./port-forward.sh status

# Test connectivity
./port-forward.sh test

# Stop port forwarding
./port-forward.sh stop

# Restart port forwarding
./port-forward.sh start
```

### Test from Windows

Open Command Prompt or PowerShell on Windows and test:

```cmd
# Test frontend
curl http://localhost:3000

# Test user service
curl http://localhost:8080/health

# Register a user
curl -X POST http://localhost:8080/api/users/register ^
  -H "Content-Type: application/json" ^
  -d "{\"username\":\"windowsuser\",\"email\":\"windows@example.com\",\"password\":\"password123\"}"

# Login user
curl -X POST http://localhost:8080/api/users/login ^
  -H "Content-Type: application/json" ^
  -d "{\"username\":\"windowsuser\",\"password\":\"password123\"}"
```

### Browser Access

Open your browser on Windows and go to:
- **Frontend**: http://localhost:3000
- **Login with**: `winuser` / `password123` (already created)

### Troubleshooting

If services are not accessible:

1. **Check port forwarding status:**
   ```bash
   ./port-forward.sh status
   ```

2. **Restart port forwarding:**
   ```bash
   ./port-forward.sh stop
   ./port-forward.sh start
   ```

3. **Check Kubernetes pods:**
   ```bash
   kubectl get pods
   ```

4. **View logs:**
   ```bash
   kubectl logs -f deployment/frontend
   kubectl logs -f deployment/user-service
   ```

### Notes

- Port forwarding runs in the background
- Services are accessible on standard ports (3000 for frontend, 8080 for user service)
- The frontend is configured to connect to the user service at localhost:8080
- All data is stored in the Kubernetes PostgreSQL database

### Architecture

```
Windows Host (localhost:3000, localhost:8080)
    ↓ Port Forward
Linux VM (kubectl port-forward)
    ↓
Minikube Kubernetes Cluster
    ├── Frontend Pod (port 80)
    ├── User Service Pod (port 8080)
    └── PostgreSQL Pod (port 5432)
```
