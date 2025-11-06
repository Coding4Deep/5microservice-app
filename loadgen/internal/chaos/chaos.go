package chaos

import (
	"context"
	"math/rand"
	"net/http"
	"time"
	"loadgen/internal/config"
)

type ChaosMiddleware struct {
	config *config.Chaos
}

func New(cfg *config.Chaos) *ChaosMiddleware {
	return &ChaosMiddleware{config: cfg}
}

func (c *ChaosMiddleware) WrapTransport(rt http.RoundTripper) http.RoundTripper {
	return &chaosTransport{
		base:   rt,
		config: c.config,
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
		select {
		case <-time.After(delay):
		case <-req.Context().Done():
			return nil, req.Context().Err()
		}
	}

	resp, err := ct.base.RoundTrip(req)
	
	// Random error injection
	if err == nil && rand.Float64() < ct.config.ErrorRate {
		resp.StatusCode = 500
		resp.Status = "500 Internal Server Error"
	}

	return resp, err
}
