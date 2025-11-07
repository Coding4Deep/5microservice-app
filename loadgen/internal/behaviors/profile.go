package behaviors

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"time"

	"go.opentelemetry.io/otel"
	"loadgen/internal/config"
	"loadgen/internal/metrics"
)

type ProfileBehavior struct {
	baseURL string
	client  *http.Client
}

type ProfileUpdateRequest struct {
	Bio      string `json:"bio"`
	Location string `json:"location"`
}

func NewProfile(cfg *config.Config) *ProfileBehavior {
	return &ProfileBehavior{
		baseURL: cfg.Services.ProfileService.BaseURL,
		client:  &http.Client{Timeout: 10 * time.Second},
	}
}

func (p *ProfileBehavior) UpdateProfile(ctx context.Context, token, userID string) {
	tracer := otel.Tracer("loadgen")
	ctx, span := tracer.Start(ctx, "profile.update_profile")
	defer span.End()

	start := time.Now()
	defer func() {
		metrics.RequestDuration.WithLabelValues("profile", "update_profile").Observe(time.Since(start).Seconds())
	}()

	bios := []string{
		"Load testing user 🤖",
		"Testing the profile service",
		"Automated user for testing",
		"Hello from load generator!",
	}
	locations := []string{
		"Load Test City",
		"Testing Town",
		"Automation Land",
		"Virtual World",
	}

	reqBody := ProfileUpdateRequest{
		Bio:      bios[time.Now().Unix()%int64(len(bios))],
		Location: locations[time.Now().Unix()%int64(len(locations))],
	}

	body, _ := json.Marshal(reqBody)
	req, _ := http.NewRequestWithContext(ctx, "PUT", p.baseURL+"/api/profile/"+userID, bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+token)

	resp, err := p.client.Do(req)
	if err != nil {
		metrics.RequestsTotal.WithLabelValues("profile", "update_profile", "error").Inc()
		log.Printf("❌ Failed to update profile: %v", err)
		return
	}
	defer resp.Body.Close()

	status := fmt.Sprintf("%d", resp.StatusCode)
	metrics.RequestsTotal.WithLabelValues("profile", "update_profile", status).Inc()

	if resp.StatusCode == http.StatusOK {
		log.Printf("✅ Updated profile for user %s", userID)
	} else {
		log.Printf("❌ Failed to update profile, status: %d", resp.StatusCode)
	}
}

func (p *ProfileBehavior) GetProfile(ctx context.Context, token, userID string) {
	tracer := otel.Tracer("loadgen")
	ctx, span := tracer.Start(ctx, "profile.get_profile")
	defer span.End()

	start := time.Now()
	defer func() {
		metrics.RequestDuration.WithLabelValues("profile", "get_profile").Observe(time.Since(start).Seconds())
	}()

	req, _ := http.NewRequestWithContext(ctx, "GET", p.baseURL+"/api/profile/"+userID, nil)
	req.Header.Set("Authorization", "Bearer "+token)

	resp, err := p.client.Do(req)
	if err != nil {
		metrics.RequestsTotal.WithLabelValues("profile", "get_profile", "error").Inc()
		return
	}
	defer resp.Body.Close()

	status := fmt.Sprintf("%d", resp.StatusCode)
	metrics.RequestsTotal.WithLabelValues("profile", "get_profile", status).Inc()
}
