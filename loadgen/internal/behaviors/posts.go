package behaviors

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log"
	"mime/multipart"
	"net/http"
	"time"

	"go.opentelemetry.io/otel"
	"loadgen/internal/config"
	"loadgen/internal/metrics"
)

type PostsBehavior struct {
	baseURL string
	client  *http.Client
}

type Post struct {
	ID      string `json:"id"`
	Content string `json:"content"`
	Author  string `json:"author"`
	Likes   int    `json:"likes"`
}

type CreatePostRequest struct {
	Content string `json:"content"`
}

func NewPosts(cfg *config.Config) *PostsBehavior {
	return &PostsBehavior{
		baseURL: cfg.Services.PostsService.BaseURL,
		client:  &http.Client{Timeout: 10 * time.Second},
	}
}

func (p *PostsBehavior) GetPosts(ctx context.Context, token string) []Post {
	tracer := otel.Tracer("loadgen")
	ctx, span := tracer.Start(ctx, "posts.get_posts")
	defer span.End()

	start := time.Now()
	defer func() {
		metrics.RequestDuration.WithLabelValues("posts", "get_posts").Observe(time.Since(start).Seconds())
	}()

	req, _ := http.NewRequestWithContext(ctx, "GET", p.baseURL+"/api/posts", nil)
	req.Header.Set("Authorization", "Bearer "+token)

	resp, err := p.client.Do(req)
	if err != nil {
		metrics.RequestsTotal.WithLabelValues("posts", "get_posts", "error").Inc()
		return nil
	}
	defer resp.Body.Close()

	status := fmt.Sprintf("%d", resp.StatusCode)
	metrics.RequestsTotal.WithLabelValues("posts", "get_posts", status).Inc()

	if resp.StatusCode != http.StatusOK {
		return nil
	}

	var posts []Post
	json.NewDecoder(resp.Body).Decode(&posts)
	return posts
}

func (p *PostsBehavior) CreatePost(ctx context.Context, token, content string) {
	tracer := otel.Tracer("loadgen")
	ctx, span := tracer.Start(ctx, "posts.create_post")
	defer span.End()

	start := time.Now()
	defer func() {
		metrics.RequestDuration.WithLabelValues("posts", "create_post").Observe(time.Since(start).Seconds())
	}()

	// Create multipart form data for image post
	var body bytes.Buffer
	writer := multipart.NewWriter(&body)

	// Add caption field
	writer.WriteField("caption", content)

	// Add a dummy image file
	part, _ := writer.CreateFormFile("image", "test.txt")
	part.Write([]byte("dummy image content for load test"))
	writer.Close()

	req, _ := http.NewRequestWithContext(ctx, "POST", p.baseURL+"/api/posts", &body)
	req.Header.Set("Content-Type", writer.FormDataContentType())
	req.Header.Set("Authorization", "Bearer "+token)

	resp, err := p.client.Do(req)
	if err != nil {
		metrics.RequestsTotal.WithLabelValues("posts", "create_post", "error").Inc()
		log.Printf("❌ Failed to create post: %v", err)
		return
	}
	defer resp.Body.Close()

	status := fmt.Sprintf("%d", resp.StatusCode)
	metrics.RequestsTotal.WithLabelValues("posts", "create_post", status).Inc()

	if resp.StatusCode == http.StatusCreated || resp.StatusCode == http.StatusOK {
		log.Printf("✅ Created post: %s", content)
	} else {
		log.Printf("❌ Failed to create post, status: %d", resp.StatusCode)
	}
}

func (p *PostsBehavior) LikePost(ctx context.Context, token, postID string) {
	tracer := otel.Tracer("loadgen")
	ctx, span := tracer.Start(ctx, "posts.like_post")
	defer span.End()

	start := time.Now()
	defer func() {
		metrics.RequestDuration.WithLabelValues("posts", "like_post").Observe(time.Since(start).Seconds())
	}()

	req, _ := http.NewRequestWithContext(ctx, "POST", p.baseURL+"/api/posts/"+postID+"/like", nil)
	req.Header.Set("Authorization", "Bearer "+token)

	resp, err := p.client.Do(req)
	if err != nil {
		metrics.RequestsTotal.WithLabelValues("posts", "like_post", "error").Inc()
		return
	}
	defer resp.Body.Close()

	status := fmt.Sprintf("%d", resp.StatusCode)
	metrics.RequestsTotal.WithLabelValues("posts", "like_post", status).Inc()
}
