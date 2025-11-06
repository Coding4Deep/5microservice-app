package behaviors

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log"
	"math/rand"
	"net/http"
	"time"

	"go.opentelemetry.io/otel"
	"loadgen/internal/config"
	"loadgen/internal/metrics"
)

type AuthBehavior struct {
	baseURL string
	client  *http.Client
}

type LoginRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

type RegisterRequest struct {
	Username string `json:"username"`
	Email    string `json:"email"`
	Password string `json:"password"`
}

type AuthResponse struct {
	Token string `json:"token"`
	User  struct {
		ID       int    `json:"id"`
		Username string `json:"username"`
	} `json:"user"`
}

func NewAuth(cfg *config.Config) *AuthBehavior {
	client := &http.Client{Timeout: 10 * time.Second}
	
	// Add chaos middleware if configured
	if cfg.Chaos.ErrorRate > 0 || cfg.Chaos.DelayRate > 0 {
		chaos := &chaosTransport{
			base:   client.Transport,
			config: &cfg.Chaos,
		}
		if client.Transport == nil {
			chaos.base = http.DefaultTransport
		}
		client.Transport = chaos
	}
	
	return &AuthBehavior{
		baseURL: cfg.Services.UserService.BaseURL,
		client:  client,
	}
}

type chaosTransport struct {
	base   http.RoundTripper
	config *config.Chaos
}

func (ct *chaosTransport) RoundTrip(req *http.Request) (*http.Response, error) {
	// Random delay injection
	if rand.Float64() < ct.config.DelayRate {
		delay := time.Duration(rand.Intn(ct.config.MaxDelayMs)) * time.Millisecond
		log.Printf("🌪️ Chaos: Adding %v delay to %s", delay, req.URL.Path)
		time.Sleep(delay)
	}

	resp, err := ct.base.RoundTrip(req)
	
	// Random error injection
	if err == nil && rand.Float64() < ct.config.ErrorRate {
		log.Printf("🌪️ Chaos: Injecting 500 error for %s", req.URL.Path)
		resp.StatusCode = 500
		resp.Status = "500 Internal Server Error"
	}

	return resp, err
}

func (a *AuthBehavior) Login(ctx context.Context, username, password string) (string, error) {
	tracer := otel.Tracer("loadgen")
	ctx, span := tracer.Start(ctx, "auth.login")
	defer span.End()

	start := time.Now()
	defer func() {
		metrics.RequestDuration.WithLabelValues("user", "login").Observe(time.Since(start).Seconds())
	}()

	req := LoginRequest{Username: username, Password: password}
	body, _ := json.Marshal(req)

	httpReq, _ := http.NewRequestWithContext(ctx, "POST", a.baseURL+"/api/users/login", bytes.NewBuffer(body))
	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := a.client.Do(httpReq)
	if err != nil {
		metrics.RequestsTotal.WithLabelValues("user", "login", "error").Inc()
		return "", err
	}
	defer resp.Body.Close()

	status := fmt.Sprintf("%d", resp.StatusCode)
	metrics.RequestsTotal.WithLabelValues("user", "login", status).Inc()

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("login failed: %d", resp.StatusCode)
	}

	var authResp AuthResponse
	if err := json.NewDecoder(resp.Body).Decode(&authResp); err != nil {
		return "", err
	}

	return authResp.Token, nil
}

func (a *AuthBehavior) Register(ctx context.Context, username, email, password string) error {
	tracer := otel.Tracer("loadgen")
	ctx, span := tracer.Start(ctx, "auth.register")
	defer span.End()

	start := time.Now()
	defer func() {
		metrics.RequestDuration.WithLabelValues("user", "register").Observe(time.Since(start).Seconds())
	}()

	req := RegisterRequest{Username: username, Email: email, Password: password}
	body, _ := json.Marshal(req)

	httpReq, _ := http.NewRequestWithContext(ctx, "POST", a.baseURL+"/api/users/register", bytes.NewBuffer(body))
	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := a.client.Do(httpReq)
	if err != nil {
		metrics.RequestsTotal.WithLabelValues("user", "register", "error").Inc()
		return err
	}
	defer resp.Body.Close()

	status := fmt.Sprintf("%d", resp.StatusCode)
	metrics.RequestsTotal.WithLabelValues("user", "register", status).Inc()

	if resp.StatusCode != http.StatusCreated && resp.StatusCode != http.StatusOK {
		return fmt.Errorf("register failed: %d", resp.StatusCode)
	}

	return nil
}
