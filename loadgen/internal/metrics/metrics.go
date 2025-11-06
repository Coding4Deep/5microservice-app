package metrics

import (
	"net/http"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

var (
	RequestsTotal = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "loadgen_requests_total",
			Help: "Total number of requests made",
		},
		[]string{"service", "method", "status"},
	)

	RequestDuration = prometheus.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "loadgen_request_duration_seconds",
			Help:    "Request duration in seconds",
			Buckets: prometheus.DefBuckets,
		},
		[]string{"service", "method"},
	)

	ActiveUsers = prometheus.NewGauge(
		prometheus.GaugeOpts{
			Name: "loadgen_active_users",
			Help: "Number of active simulated users",
		},
	)

	WebSocketConnections = prometheus.NewGauge(
		prometheus.GaugeOpts{
			Name: "loadgen_websocket_connections",
			Help: "Number of active WebSocket connections",
		},
	)
)

func init() {
	prometheus.MustRegister(RequestsTotal, RequestDuration, ActiveUsers, WebSocketConnections)
}

func StartServer(addr string) *http.Server {
	mux := http.NewServeMux()
	mux.Handle("/metrics", promhttp.Handler())
	
	server := &http.Server{
		Addr:    addr,
		Handler: mux,
	}
	
	go server.ListenAndServe()
	return server
}
