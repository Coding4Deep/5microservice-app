package behaviors

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"net/url"
	"time"

	"github.com/gorilla/websocket"
	"go.opentelemetry.io/otel"
	"loadgen/internal/config"
	"loadgen/internal/metrics"
)

type ChatBehavior struct {
	baseURL string
	conn    *websocket.Conn
	client  *http.Client
	token   string
	username string
}

type ChatMessage struct {
	Message   string `json:"message"`
	Room      string `json:"room"`
	IsPrivate bool   `json:"isPrivate"`
}

func NewChat(cfg *config.Config) *ChatBehavior {
	return &ChatBehavior{
		baseURL: cfg.Services.ChatService.BaseURL,
		client:  &http.Client{Timeout: 10 * time.Second},
	}
}

func (c *ChatBehavior) Connect(ctx context.Context, token string) {
	c.token = token
	
	tracer := otel.Tracer("loadgen")
	ctx, span := tracer.Start(ctx, "chat.connect")
	defer span.End()

	// Try WebSocket connection with proper Socket.IO handshake
	u, _ := url.Parse(c.baseURL)
	u.Scheme = "ws"
	u.Path = "/socket.io/"
	u.RawQuery = "EIO=4&transport=websocket"

	dialer := websocket.Dialer{
		HandshakeTimeout: 10 * time.Second,
	}

	conn, _, err := dialer.DialContext(ctx, u.String(), nil)
	if err != nil {
		log.Printf("WebSocket connection failed: %v", err)
		return
	}

	c.conn = conn
	metrics.WebSocketConnections.Inc()
	defer func() {
		metrics.WebSocketConnections.Dec()
		conn.Close()
	}()

	// Socket.IO handshake sequence
	c.conn.WriteMessage(websocket.TextMessage, []byte("40"))
	time.Sleep(100 * time.Millisecond)
	
	// Send join message with username
	username := fmt.Sprintf("loadtest_user_%d", time.Now().Unix()%1000)
	joinMsg := fmt.Sprintf(`42["join","%s"]`, username)
	c.conn.WriteMessage(websocket.TextMessage, []byte(joinMsg))
	c.username = username
	
	log.Printf("✅ WebSocket connected for %s", username)
	
	// Listen for messages in background
	go c.readMessages(ctx)

	// Keep connection alive with ping
	ticker := time.NewTicker(25 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			c.conn.WriteMessage(websocket.TextMessage, []byte("2"))
		}
	}
}

func (c *ChatBehavior) readMessages(ctx context.Context) {
	for {
		select {
		case <-ctx.Done():
			return
		default:
			_, message, err := c.conn.ReadMessage()
			if err != nil {
				return
			}
			// Log received messages for debugging
			if len(message) > 2 && string(message[:2]) == "42" {
				log.Printf("📨 Received chat message: %s", string(message[2:]))
			}
		}
	}
}

func (c *ChatBehavior) SendMessage(ctx context.Context, message string) {
	tracer := otel.Tracer("loadgen")
	ctx, span := tracer.Start(ctx, "chat.send_message")
	defer span.End()

	start := time.Now()
	defer func() {
		metrics.RequestDuration.WithLabelValues("chat", "send_message").Observe(time.Since(start).Seconds())
	}()

	if c.conn == nil {
		metrics.RequestsTotal.WithLabelValues("chat", "send_message", "no_connection").Inc()
		log.Printf("⚠️ No WebSocket connection for message: %s", message)
		return
	}

	// Send via WebSocket using Socket.IO protocol - this will appear in real-time chat
	socketIOMsg := fmt.Sprintf(`42["message",{"message":"%s","room":"general","isPrivate":false}]`, message)

	err := c.conn.WriteMessage(websocket.TextMessage, []byte(socketIOMsg))
	if err != nil {
		metrics.RequestsTotal.WithLabelValues("chat", "send_message", "error").Inc()
		log.Printf("❌ Failed to send WebSocket message: %v", err)
		c.conn = nil
	} else {
		metrics.RequestsTotal.WithLabelValues("chat", "send_message", "200").Inc()
		log.Printf("✅ Sent chat message: %s", message)
	}
}

func (c *ChatBehavior) GetMessages(ctx context.Context) {
	tracer := otel.Tracer("loadgen")
	ctx, span := tracer.Start(ctx, "chat.get_messages")
	defer span.End()

	start := time.Now()
	defer func() {
		metrics.RequestDuration.WithLabelValues("chat", "get_messages").Observe(time.Since(start).Seconds())
	}()

	httpReq, _ := http.NewRequestWithContext(ctx, "GET", c.baseURL+"/api/messages", nil)
	httpReq.Header.Set("Authorization", "Bearer "+c.token)

	resp, err := c.client.Do(httpReq)
	if err != nil {
		metrics.RequestsTotal.WithLabelValues("chat", "get_messages", "error").Inc()
		return
	}
	defer resp.Body.Close()

	status := fmt.Sprintf("%d", resp.StatusCode)
	metrics.RequestsTotal.WithLabelValues("chat", "get_messages", status).Inc()
}
