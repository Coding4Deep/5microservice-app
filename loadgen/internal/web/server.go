package web

import (
	"context"
	"encoding/json"
	"html/template"
	"io"
	"net/http"
	"regexp"
	"strconv"
	"sync"
	"time"

	"loadgen/internal/cleanup"
	"loadgen/internal/config"
	"loadgen/internal/generator"
)

type WebServer struct {
	config      *config.Config
	currentTest *TestRun
	reports     []TestReport
	cleanup     *cleanup.Cleanup
	mu          sync.RWMutex
}

type TestRun struct {
	Users     int       `json:"users"`
	Duration  string    `json:"duration"`
	Ramp      string    `json:"ramp"`
	Status    string    `json:"status"`
	StartTime time.Time `json:"start_time"`
	cancel    context.CancelFunc
}

type TestReport struct {
	ID           int                    `json:"id"`
	Users        int                    `json:"users"`
	Duration     string                 `json:"duration"`
	Ramp         string                 `json:"ramp"`
	StartTime    time.Time              `json:"start_time"`
	EndTime      time.Time              `json:"end_time"`
	Status       string                 `json:"status"`
	Metrics      map[string]interface{} `json:"metrics"`
	TrackedUsers []string               `json:"tracked_users"`
}

func NewWebServer(cfg *config.Config) *WebServer {
	return &WebServer{
		config:  cfg,
		reports: make([]TestReport, 0),
		cleanup: cleanup.New(cfg),
	}
}

func (ws *WebServer) Start(addr string) *http.Server {
	mux := http.NewServeMux()
	mux.HandleFunc("/", ws.handleHome)
	mux.HandleFunc("/api/start", ws.handleStart)
	mux.HandleFunc("/api/stop", ws.handleStop)
	mux.HandleFunc("/api/status", ws.handleStatus)
	mux.HandleFunc("/api/overview", ws.handleOverview)
	mux.HandleFunc("/api/reports", ws.handleReports)
	mux.HandleFunc("/api/reduce", ws.handleReduceLoad)
	mux.HandleFunc("/api/delete-users", ws.handleDeleteUsers)
	mux.HandleFunc("/api/delete-user", ws.handleDeleteUser)
	mux.HandleFunc("/metrics", ws.handleMetricsProxy)

	server := &http.Server{
		Addr:    addr,
		Handler: mux,
	}

	go server.ListenAndServe()
	return server
}

const htmlTemplate = `
<!DOCTYPE html>
<html>
<head>
    <title>Load Generator Control Panel</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; }
        .card { background: white; padding: 20px; margin: 20px 0; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .form-group { margin: 15px 0; }
        label { display: block; margin-bottom: 5px; font-weight: bold; }
        input, select { padding: 8px; border: 1px solid #ddd; border-radius: 4px; width: 200px; }
        button { padding: 10px 20px; margin: 5px; border: none; border-radius: 4px; cursor: pointer; }
        .btn-primary { background: #007acc; color: white; }
        .btn-danger { background: #dc3545; color: white; }
        .btn-primary:hover { background: #005a9e; }
        .btn-danger:hover { background: #c82333; }
        .status { padding: 10px; border-radius: 4px; margin: 10px 0; }
        .status.running { background: #d4edda; color: #155724; }
        .status.stopped { background: #f8d7da; color: #721c24; }
        .metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; }
        .metric { background: #e9ecef; padding: 15px; border-radius: 4px; text-align: center; }
        .metric-value { font-size: 24px; font-weight: bold; color: #007acc; }
        .reports { margin-top: 20px; }
        .report { border: 1px solid #ddd; margin: 10px 0; padding: 15px; border-radius: 4px; }
        .report h4 { margin: 0 0 10px 0; color: #333; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🚀 Load Generator Control Panel</h1>
        
        <div class="card">
            <h2>Start Load Test</h2>
            <div class="form-group">
                <label>Users:</label>
                <input type="number" id="users" value="10" min="1" max="1000">
            </div>
            <div class="form-group">
                <label>Duration:</label>
                <input type="text" id="duration" value="2m" placeholder="e.g., 30s, 5m, 1h">
            </div>
            <div class="form-group">
                <label>Ramp-up Rate:</label>
                <input type="text" id="ramp" value="5/s" placeholder="e.g., 5/s, 10/s">
            </div>
            <button class="btn-primary" onclick="startTest()">Start Test</button>
            <button class="btn-danger" onclick="stopTest()">Stop Test</button>
        </div>

        <div class="card">
            <h2>Current Status</h2>
            <div id="status" class="status stopped">No test running</div>
            <div id="metrics" class="metrics"></div>
        </div>

        <div class="card">
            <h2>Reduce Load</h2>
            <p>Remove load-generated users and their data (only affects users created by load generator)</p>
            <div class="form-group">
                <label>Users to Delete:</label>
                <input type="number" id="reduceCount" value="10" min="1" max="1000">
            </div>
			<button class="btn-danger" onclick="reduceLoad()">Reduce Load</button>
			<div id="loadInfo" style="margin-top: 10px; font-size: 14px; color: #666;"></div>
			<div style="margin-top:6px; font-size:13px; color:#444;">Tracked users: <span id="trackedCount">0</span></div>
				<div id="trackedList" style="margin-top:8px; font-size:13px; color:#333;"></div>
        </div>

		<div class="card">
			<h2>Delete Users (direct)</h2>
			<p>Directly delete N test users from the user-service (usernames starting with <code>user_</code>).</p>
			<div class="form-group">
				<label>Users to Delete:</label>
				<input type="number" id="deleteCount" value="10" min="1" max="1000">
			</div>
			<button class="btn-danger" onclick="deleteUsersDirect()">Delete Users</button>
			<div id="deleteInfo" style="margin-top:10px; font-size:14px; color:#666;"></div>
		</div>

        <div class="card">
            <h2>Test Reports</h2>
            <div id="reports" class="reports"></div>
        </div>
    </div>

    <script>
        function startTest() {
            const users = document.getElementById('users').value;
            const duration = document.getElementById('duration').value;
            const ramp = document.getElementById('ramp').value;
            
            fetch('/api/start', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({users: parseInt(users), duration, ramp})
            }).then(response => response.json())
              .then(data => updateStatus());
        }

        function stopTest() {
            fetch('/api/stop', {method: 'POST'})
                .then(response => response.json())
                .then(data => updateStatus());
        }

        function updateStatus() {
            fetch('/api/status')
                .then(response => response.json())
                .then(data => {
                    const statusDiv = document.getElementById('status');
                    if (data.status === 'running') {
                        statusDiv.className = 'status running';
                        statusDiv.innerHTML = 'Running: ' + data.users + ' users, ' + data.duration + ' duration, ' + data.ramp + ' ramp-up';
                    } else {
                        statusDiv.className = 'status stopped';
                        statusDiv.innerHTML = 'No test running';
                    }
                    updateMetrics();
                });
        }

        function updateMetrics() {
			fetch('/api/overview')
					.then(response => response.json())
					.then(data => {
						const metricsDiv = document.getElementById('metrics');
						const totalUsers = data.total_users || 0;
						const activeUsers = data.metrics ? data.metrics.active_users : 0;
						const websockets = data.metrics ? data.metrics.websocket_connections : 0;
						const requests = data.metrics ? data.metrics.total_requests : 0;

						// Update tracked users list UI
						const tracked = data.tracked_users || [];
						document.getElementById('trackedCount').innerText = data.tracked_count || tracked.length || 0;
						const listDiv = document.getElementById('trackedList');
						if (tracked.length === 0) {
							listDiv.innerHTML = '<em>No tracked test users</em>';
						} else {
							listDiv.innerHTML = tracked.map(u => {
								return '<div style="margin:3px 0;">' + u + ' <button onclick="deleteSingleUser(\'' + u + '\')" style="margin-left:8px;padding:2px 6px;">Delete</button></div>';
							}).join('');
						}

						metricsDiv.innerHTML = 
							'<div class="metric"><div class="metric-value">' + totalUsers + '</div><div>Total Users</div></div>' +
							'<div class="metric"><div class="metric-value">' + activeUsers + '</div><div>Active Users</div></div>' +
							'<div class="metric"><div class="metric-value">' + websockets + '</div><div>WebSocket Connections</div></div>' +
							'<div class="metric"><div class="metric-value">' + requests + '</div><div>Total Requests</div></div>';
					})
					.catch(() => {
						document.getElementById('metrics').innerHTML = '<div class="metric"><div class="metric-value">-</div><div>Metrics Unavailable</div></div>';
					});
        }

		function deleteSingleUser(username) {
			if (!confirm('Delete user ' + username + "? This will remove the user account and related posts/messages.")) return;
			fetch('/api/delete-user', {
				method: 'POST',
				headers: {'Content-Type': 'application/json'},
				body: JSON.stringify({username: username})
			}).then(r => r.json()).then(data => {
				if (data.deleted) {
					// update UI
					document.getElementById('loadInfo').innerHTML = '<strong>✅ Deleted:</strong> ' + username + '. ' + (data.remaining || 0) + ' users remain.';
					updateMetrics();
				} else {
					document.getElementById('loadInfo').innerHTML = '<strong>❌ Failed to delete:</strong> ' + username + ' (status ' + (data.status_code||'unknown') + ')';
				}
			}).catch(err => {
				document.getElementById('loadInfo').innerHTML = '<strong>❌ Error:</strong> ' + err.message;
			});
		}

		function reduceLoad() {
			const count = parseInt(document.getElementById('reduceCount').value);

			// Confirm large deletions
			if (count > 50) {
				if (!confirm('You are about to delete ' + count + ' test users. This cannot be undone. Continue?')) {
					return;
				}
			}

			// Fetch current tracked users first, so we can report which ones were deleted
			fetch('/api/overview')
				.then(r => r.json())
				.then(before => {
					const beforeUsers = before.tracked_users || [];

					fetch('/api/reduce', {
						method: 'POST',
						headers: {'Content-Type': 'application/json'},
						body: JSON.stringify({count: count})
					}).then(response => response.json())
					  .then(data => {
							  // If the server returned deleted_users, use that; otherwise fall back to diffing overview
							  if (data.deleted_users && Array.isArray(data.deleted_users)) {
								const deleted = data.deleted_users;
								let html = '<strong>✅ Reduced load:</strong> ' + deleted.length + ' users removed. ' + (data.remaining || 0) + ' users remain.';
								if (deleted.length) html += '<div style="margin-top:6px;"><strong>Deleted:</strong> ' + deleted.join(', ') + '</div>';
								// failed users (if any)
								if (data.failed_users) {
									const failed = data.failed_users;
									const failEntries = Object.keys(failed).map(k => k + ' (status ' + failed[k] + ')');
									if (failEntries.length) html += '<div style="margin-top:6px;color:#a33;"><strong>Failed to delete:</strong> ' + failEntries.join(', ') + '</div>';
								}
								document.getElementById('loadInfo').innerHTML = html;
								// update tracked count display
								document.getElementById('trackedCount').innerText = data.remaining || 0;
							  } else {
								fetch('/api/overview')
									.then(r2 => r2.json())
									.then(after => {
										const afterUsers = after.tracked_users || [];
										const deleted = beforeUsers.filter(u => !afterUsers.includes(u));
										document.getElementById('loadInfo').innerHTML =
											'<strong>✅ Reduced load:</strong> ' + deleted.length + ' users removed. ' + after.tracked_count + ' users remain.' +
											(deleted.length ? '<div style="margin-top:6px;"><strong>Deleted:</strong> ' + deleted.join(', ') + '</div>' : '');
										// update tracked count display
										document.getElementById('trackedCount').innerText = after.tracked_count || 0;
									});
							  }
					  })
					  .catch(err => {
						  document.getElementById('loadInfo').innerHTML = '<strong>❌ Error:</strong> ' + err.message;
					  });
				})
				.catch(() => {
					document.getElementById('loadInfo').innerHTML = '<strong>❌ Error:</strong> Could not fetch tracked users';
				});
		}

		function deleteUsersDirect() {
			const count = parseInt(document.getElementById('deleteCount').value);

			if (count > 50) {
				if (!confirm('You are about to delete ' + count + ' test users directly from the user-service. This cannot be undone. Continue?')) return;
			}

			fetch('/api/delete-users', {
				method: 'POST',
				headers: {'Content-Type': 'application/json'},
				body: JSON.stringify({count: count})
			}).then(r => r.json()).then(data => {
				if (data && data.deleted_users) {
					let html = '<strong>✅ Deleted:</strong> ' + (data.deleted_users.length || 0) + ' users. ' + (data.remaining || 0) + ' users remain.';
					if (data.deleted_users.length) html += '<div style="margin-top:6px;"><strong>Deleted:</strong> ' + data.deleted_users.join(', ') + '</div>';
					if (data.failed_users) {
						const failed = data.failed_users;
						const failEntries = Object.keys(failed).map(k => k + ' (status ' + failed[k] + ')');
						if (failEntries.length) html += '<div style="margin-top:6px;color:#a33;"><strong>Failed to delete:</strong> ' + failEntries.join(', ') + '</div>';
					}
					document.getElementById('deleteInfo').innerHTML = html;
					// refresh overview/tracked list
					updateMetrics();
				} else {
					document.getElementById('deleteInfo').innerHTML = '<strong>❌ Error:</strong> Unexpected response';
				}
			}).catch(err => {
				document.getElementById('deleteInfo').innerHTML = '<strong>❌ Error:</strong> ' + err.message;
			});
		}
			function updateReports() {
				fetch('/api/reports')
					.then(response => response.json())
					.then(data => {
						const reportsDiv = document.getElementById('reports');
						if (data.length === 0) {
							reportsDiv.innerHTML = '<p>No test reports yet</p>';
							return;
						}

						reportsDiv.innerHTML = data.map(report => {
							const duration = new Date(report.end_time) - new Date(report.start_time);
							const durationStr = Math.round(duration / 1000) + 's';
							return '<div class="report">' +
							'<h4>Test #' + report.id + ' - ' + report.status.toUpperCase() + '</h4>' +
							'<p><strong>Config:</strong> ' + report.users + ' users, ' + report.duration + ' duration, ' + report.ramp + ' ramp-up</p>' +
							'<p><strong>Started:</strong> ' + new Date(report.start_time).toLocaleString() + '</p>' +
							'<p><strong>Ended:</strong> ' + new Date(report.end_time).toLocaleString() + '</p>' +
							'<p><strong>Actual Duration:</strong> ' + durationStr + '</p>' +
							'</div>';
						}).reverse().join('');
					})
					.catch(err => {
						console.error('Failed to load reports:', err);
						document.getElementById('reports').innerHTML = '<p>Error loading reports</p>';
					});
			}

			// Update every 2 seconds
			setInterval(() => {
				updateStatus();
				updateReports();
			}, 2000);

			// Initial load
			updateStatus();
			updateReports();
    </script>
</body>
</html>
`

func (ws *WebServer) handleHome(w http.ResponseWriter, r *http.Request) {
	tmpl := template.Must(template.New("home").Parse(htmlTemplate))
	tmpl.Execute(w, nil)
}

func (ws *WebServer) handleStart(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req TestRun
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid JSON", http.StatusBadRequest)
		return
	}

	ws.mu.Lock()
	defer ws.mu.Unlock()

	// Stop current test if running
	if ws.currentTest != nil && ws.currentTest.Status == "running" {
		ws.currentTest.cancel()
	}

	// Start new test
	ctx, cancel := context.WithCancel(context.Background())
	ws.currentTest = &TestRun{
		Users:     req.Users,
		Duration:  req.Duration,
		Ramp:      req.Ramp,
		Status:    "running",
		StartTime: time.Now(),
		cancel:    cancel,
	}

	// Run test in background
	go ws.runTest(ctx, req)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "started"})
}

func (ws *WebServer) handleStop(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	ws.mu.Lock()
	defer ws.mu.Unlock()

	if ws.currentTest != nil && ws.currentTest.Status == "running" {
		ws.currentTest.cancel()
		ws.currentTest.Status = "stopped"

		// Create report for stopped test
		report := TestReport{
			ID:           len(ws.reports) + 1,
			Users:        ws.currentTest.Users,
			Duration:     ws.currentTest.Duration,
			Ramp:         ws.currentTest.Ramp,
			StartTime:    ws.currentTest.StartTime,
			EndTime:      time.Now(),
			Status:       "stopped",
			Metrics:      ws.collectMetrics(),
			TrackedUsers: ws.cleanup.GetTrackedUsers(),
		}
		ws.reports = append(ws.reports, report)
		ws.currentTest = nil
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "stopped"})
}

func (ws *WebServer) handleReduceLoad(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		Count int `json:"count"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid JSON", http.StatusBadRequest)
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	// Delete test users (usernames starting with "user_") up to requested count
	deletedUsers, failed := ws.cleanup.DeleteTestUsers(ctx, req.Count)
	remaining := len(ws.cleanup.GetTrackedUsers())

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"deleted_count":   len(deletedUsers),
		"deleted_users":   deletedUsers,
		"failed_users":    failed,
		"remaining":       remaining,
		"status":          "completed",
	})
}

func (ws *WebServer) handleDeleteUsers(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct{
		Count int `json:"count"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid JSON", http.StatusBadRequest)
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()

	// Use concurrent deletion; concurrency tuned to 10
	deletedUsers, failed := ws.cleanup.DeleteRandomTestUsersConcurrent(ctx, req.Count, 10)
	remaining := len(ws.cleanup.GetTrackedUsers())

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"deleted_count": len(deletedUsers),
		"deleted_users": deletedUsers,
		"failed_users": failed,
		"remaining": remaining,
		"status": "completed",
	})
}

func (ws *WebServer) handleDeleteUser(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct{
		Username string `json:"username"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid JSON", http.StatusBadRequest)
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	deleted, code := ws.cleanup.DeleteUser(ctx, req.Username)
	remaining := len(ws.cleanup.GetTrackedUsers())

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"deleted": deleted,
		"status_code": code,
		"remaining": remaining,
	})
}

func (ws *WebServer) collectMetrics() map[string]interface{} {
	// Collect current metrics from Prometheus endpoint
	resp, err := http.Get("http://localhost:" + ws.config.MetricsPort + "/metrics")
	if err != nil {
		return map[string]interface{}{"error": "Could not collect metrics"}
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return map[string]interface{}{"error": "Could not read metrics"}
	}

	txt := string(body)
	metrics := make(map[string]interface{})
	metrics["timestamp"] = time.Now()
	metrics["status"] = "collected"

	// Parse a few useful values
	reActive := regexp.MustCompile(`loadgen_active_users\s+(\d+)`)
	reWS := regexp.MustCompile(`loadgen_websocket_connections\s+(\d+)`)
	reReq := regexp.MustCompile(`loadgen_requests_total(?:.*?)\s+(\d+)`)

	if m := reActive.FindStringSubmatch(txt); len(m) == 2 {
		if v, err := strconv.Atoi(m[1]); err == nil {
			metrics["active_users"] = v
		}
	}
	if m := reWS.FindStringSubmatch(txt); len(m) == 2 {
		if v, err := strconv.Atoi(m[1]); err == nil {
			metrics["websocket_connections"] = v
		}
	}
	// For requests we take the last matched value if present
	if m := reReq.FindAllStringSubmatch(txt, -1); len(m) > 0 {
		last := m[len(m)-1]
		if len(last) == 2 {
			if v, err := strconv.Atoi(last[1]); err == nil {
				metrics["total_requests"] = v
			}
		}
	}

	return metrics
}

// handleMetricsProxy proxies the metrics endpoint so the browser can fetch /metrics relative to the web UI
func (ws *WebServer) handleMetricsProxy(w http.ResponseWriter, r *http.Request) {
	resp, err := http.Get("http://localhost:" + ws.config.MetricsPort + "/metrics")
	if err != nil {
		http.Error(w, "Could not fetch metrics", http.StatusBadGateway)
		return
	}
	defer resp.Body.Close()
	w.Header().Set("Content-Type", "text/plain; version=0.0.4")
	io.Copy(w, resp.Body)
}

// handleOverview returns total users from the user service, tracked users and parsed metrics
func (ws *WebServer) handleOverview(w http.ResponseWriter, r *http.Request) {
	// Call user service dashboard
	totalUsers := 0
	userURL := ws.config.Services.UserService.BaseURL + "/api/users/dashboard"
	resp, err := http.Get(userURL)
	if err == nil {
		defer resp.Body.Close()
		var data map[string]interface{}
		if err := json.NewDecoder(resp.Body).Decode(&data); err == nil {
			if t, ok := data["totalUsers"]; ok {
				// totalUsers may be float64 from JSON
				switch v := t.(type) {
				case float64:
					totalUsers = int(v)
				case int:
					totalUsers = v
				}
			}
		}
	}

	metrics := ws.collectMetrics()

	overview := map[string]interface{}{
		"total_users":   totalUsers,
		"tracked_users": ws.cleanup.GetTrackedUsers(),
		"tracked_count": len(ws.cleanup.GetTrackedUsers()),
		"metrics":       metrics,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(overview)
}

func (ws *WebServer) handleStatus(w http.ResponseWriter, r *http.Request) {
	ws.mu.RLock()
	defer ws.mu.RUnlock()

	if ws.currentTest == nil {
		json.NewEncoder(w).Encode(map[string]string{"status": "stopped"})
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(ws.currentTest)
}

func (ws *WebServer) handleReports(w http.ResponseWriter, r *http.Request) {
	ws.mu.RLock()
	defer ws.mu.RUnlock()

	w.Header().Set("Content-Type", "application/json")
	// Return only the most recent 5 reports
	reports := ws.reports
	if len(reports) > 5 {
		reports = reports[len(reports)-5:]
	}
	json.NewEncoder(w).Encode(reports)
}

func (ws *WebServer) runTest(ctx context.Context, req TestRun) {
	duration, err := time.ParseDuration(req.Duration)
	if err != nil {
		ws.mu.Lock()
		if ws.currentTest != nil {
			ws.currentTest.Status = "error"
		}
		ws.mu.Unlock()
		return
	}

	gen := generator.New(ws.config, req.Users, duration, req.Ramp, ws.cleanup)

	startTime := time.Now()
	gen.Run(ctx)
	endTime := time.Now()

	// Create report
	ws.mu.Lock()
	status := "completed"
	if ws.currentTest != nil && ws.currentTest.Status == "stopped" {
		status = "stopped"
	}

	report := TestReport{
		ID:           len(ws.reports) + 1,
		Users:        req.Users,
		Duration:     req.Duration,
		Ramp:         req.Ramp,
		StartTime:    startTime,
		EndTime:      endTime,
		Status:       status,
		Metrics:      ws.collectMetrics(),
		TrackedUsers: gen.GetTrackedUsers(),
	}
	ws.reports = append(ws.reports, report)
	ws.currentTest = nil
	ws.mu.Unlock()
}
