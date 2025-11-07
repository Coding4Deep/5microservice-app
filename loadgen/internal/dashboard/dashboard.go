package dashboard

import (
	"html/template"
	"net/http"
	"time"
)

type Stats struct {
	TotalRequests  int64
	SuccessRate    float64
	AvgLatency     float64
	P95Latency     float64
	ActiveUsers    int64
	WebSocketConns int64
	StartTime      time.Time
	Duration       time.Duration
}

const dashboardHTML = `
<!DOCTYPE html>
<html>
<head>
    <title>Load Generator Dashboard</title>
    <meta http-equiv="refresh" content="5">
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .metric { background: #f5f5f5; padding: 15px; margin: 10px 0; border-radius: 5px; }
        .metric h3 { margin: 0 0 10px 0; color: #333; }
        .metric .value { font-size: 24px; font-weight: bold; color: #007acc; }
        .header { background: #007acc; color: white; padding: 20px; border-radius: 5px; margin-bottom: 20px; }
    </style>
</head>
<body>
    <div class="header">
        <h1>🚀 Load Generator Dashboard</h1>
        <p>Real-time metrics for microservices load testing</p>
    </div>
    
    <div class="metric">
        <h3>📊 Total Requests</h3>
        <div class="value">{{.TotalRequests}}</div>
    </div>
    
    <div class="metric">
        <h3>✅ Success Rate</h3>
        <div class="value">{{printf "%.2f" .SuccessRate}}%</div>
    </div>
    
    <div class="metric">
        <h3>⏱️ Average Latency</h3>
        <div class="value">{{printf "%.2f" .AvgLatency}}ms</div>
    </div>
    
    <div class="metric">
        <h3>📈 P95 Latency</h3>
        <div class="value">{{printf "%.2f" .P95Latency}}ms</div>
    </div>
    
    <div class="metric">
        <h3>👥 Active Users</h3>
        <div class="value">{{.ActiveUsers}}</div>
    </div>
    
    <div class="metric">
        <h3>🔌 WebSocket Connections</h3>
        <div class="value">{{.WebSocketConns}}</div>
    </div>
    
    <div class="metric">
        <h3>⏰ Test Duration</h3>
        <div class="value">{{.Duration}}</div>
    </div>
    
    <p><a href="/metrics">📊 Raw Metrics</a> | <a href="http://localhost:9091">📈 Prometheus</a> | <a href="http://localhost:3001">📊 Grafana</a></p>
</body>
</html>
`

func StartDashboard(addr string) *http.Server {
	tmpl := template.Must(template.New("dashboard").Parse(dashboardHTML))

	mux := http.NewServeMux()
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		stats := Stats{
			TotalRequests:  1234, // TODO: Get from metrics
			SuccessRate:    98.5,
			AvgLatency:     45.2,
			P95Latency:     120.5,
			ActiveUsers:    50,
			WebSocketConns: 45,
			StartTime:      time.Now().Add(-5 * time.Minute),
			Duration:       5 * time.Minute,
		}

		w.Header().Set("Content-Type", "text/html")
		tmpl.Execute(w, stats)
	})

	server := &http.Server{
		Addr:    addr,
		Handler: mux,
	}

	go server.ListenAndServe()
	return server
}
