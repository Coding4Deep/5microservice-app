package config

import (
	"gopkg.in/yaml.v3"
	"os"
	"strconv"
)

type Config struct {
	Services    Services `yaml:"services"`
	Tracing     Tracing  `yaml:"tracing"`
	Chaos       Chaos    `yaml:"chaos"`
	WebPort     string   `yaml:"web_port"`
	MetricsPort string   `yaml:"metrics_port"`
}

type Services struct {
	UserService    Service `yaml:"user_service"`
	ChatService    Service `yaml:"chat_service"`
	PostsService   Service `yaml:"posts_service"`
	ProfileService Service `yaml:"profile_service"`
}

type Service struct {
	BaseURL string `yaml:"base_url"`
	Timeout string `yaml:"timeout"`
}

type Tracing struct {
	Endpoint string `yaml:"endpoint"`
	Enabled  bool   `yaml:"enabled"`
}

type Chaos struct {
	ErrorRate  float64 `yaml:"error_rate"`
	DelayRate  float64 `yaml:"delay_rate"`
	MaxDelayMs int     `yaml:"max_delay_ms"`
}

func Load(path string) (*Config, error) {
	// Default config
	cfg := &Config{
		Services: Services{
			UserService:    Service{BaseURL: "http://localhost:8080", Timeout: "10s"},
			ChatService:    Service{BaseURL: "http://localhost:3001", Timeout: "10s"},
			PostsService:   Service{BaseURL: "http://localhost:8083", Timeout: "10s"},
			ProfileService: Service{BaseURL: "http://localhost:8081", Timeout: "10s"},
		},
		Tracing: Tracing{
			Endpoint: "",
			Enabled:  false,
		},
		Chaos: Chaos{
			ErrorRate:  0.1,
			DelayRate:  0.15,
			MaxDelayMs: 1000,
		},
		WebPort:     "3002",
		MetricsPort: "9090",
	}

	// Load from YAML if exists
	if _, err := os.Stat(path); err == nil {
		data, err := os.ReadFile(path)
		if err == nil {
			yaml.Unmarshal(data, cfg)
		}
	}

	// Override with environment variables
	if url := os.Getenv("USER_SERVICE_URL"); url != "" {
		cfg.Services.UserService.BaseURL = url
	}
	if url := os.Getenv("CHAT_SERVICE_URL"); url != "" {
		cfg.Services.ChatService.BaseURL = url
	}
	if url := os.Getenv("POSTS_SERVICE_URL"); url != "" {
		cfg.Services.PostsService.BaseURL = url
	}
	if url := os.Getenv("PROFILE_SERVICE_URL"); url != "" {
		cfg.Services.ProfileService.BaseURL = url
	}
	if endpoint := os.Getenv("JAEGER_ENDPOINT"); endpoint != "" {
		cfg.Tracing.Endpoint = endpoint
	}
	if enabled := os.Getenv("TRACING_ENABLED"); enabled == "false" {
		cfg.Tracing.Enabled = false
	}
	if rate := os.Getenv("CHAOS_ERROR_RATE"); rate != "" {
		if f, err := strconv.ParseFloat(rate, 64); err == nil {
			cfg.Chaos.ErrorRate = f
		}
	}
	if rate := os.Getenv("CHAOS_DELAY_RATE"); rate != "" {
		if f, err := strconv.ParseFloat(rate, 64); err == nil {
			cfg.Chaos.DelayRate = f
		}
	}
	if delay := os.Getenv("CHAOS_MAX_DELAY_MS"); delay != "" {
		if i, err := strconv.Atoi(delay); err == nil {
			cfg.Chaos.MaxDelayMs = i
		}
	}
	if port := os.Getenv("WEB_PORT"); port != "" {
		cfg.WebPort = port
	}
	if port := os.Getenv("METRICS_PORT"); port != "" {
		cfg.MetricsPort = port
	}

	return cfg, nil
}
