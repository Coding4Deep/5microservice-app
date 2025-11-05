package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"runtime"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/gin-contrib/requestid"
	"github.com/gin-gonic/gin"
	"github.com/go-redis/redis/v8"
	"github.com/google/uuid"
	_ "github.com/lib/pq"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"github.com/sirupsen/logrus"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/propagation"
)

// Configure structured logging
func init() {
	logrus.SetFormatter(&logrus.JSONFormatter{
		TimestampFormat: time.RFC3339,
		FieldMap: logrus.FieldMap{
			logrus.FieldKeyTime:  "timestamp",
			logrus.FieldKeyLevel: "level",
			logrus.FieldKeyMsg:   "message",
		},
	})
	logrus.SetOutput(os.Stdout)
	logrus.SetLevel(logrus.InfoLevel)
}

// Logging middleware
func LoggingMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()

		requestID := c.GetHeader("X-Request-ID")
		if requestID == "" {
			requestID = uuid.New().String()
		}

		traceID := c.GetHeader("X-Trace-ID")
		if traceID == "" {
			traceID = uuid.New().String()
		}

		c.Set("requestId", requestID)
		c.Set("traceId", traceID)
		c.Header("X-Request-ID", requestID)
		c.Header("X-Trace-ID", traceID)

		// Create logger with correlation context
		logger := logrus.WithFields(logrus.Fields{
			"service":     os.Getenv("SERVICE_NAME"),
			"instance":    getHostname(),
			"version":     getEnv("SERVICE_VERSION", "1.0.0"),
			"environment": getEnv("ENVIRONMENT", "development"),
			"requestId":   requestID,
			"traceId":     traceID,
			"method":      c.Request.Method,
			"path":        c.Request.URL.Path,
		})

		c.Set("logger", logger)
		c.Next()

		duration := time.Since(start)
		logger.WithFields(logrus.Fields{
			"status":   c.Writer.Status(),
			"duration": duration.Milliseconds(),
		}).Info("Request completed")
	}
}

func getHostname() string {
	if hostname := os.Getenv("HOSTNAME"); hostname != "" {
		return hostname
	}
	hostname, _ := os.Hostname()
	return hostname
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

type Post struct {
	ID         int       `json:"id" db:"id"`
	UserID     int       `json:"user_id" db:"user_id"`
	Username   string    `json:"username" db:"username"`
	Caption    string    `json:"caption" db:"caption"`
	ImageURL   string    `json:"image_url" db:"image_url"`
	ImageID    string    `json:"image_id" db:"image_id"`
	LikesCount int       `json:"likes_count" db:"likes_count"`
	CreatedAt  time.Time `json:"created_at" db:"created_at"`
	UpdatedAt  time.Time `json:"updated_at" db:"updated_at"`
}

type Like struct {
	ID     int `json:"id" db:"id"`
	PostID int `json:"post_id" db:"post_id"`
	UserID int `json:"user_id" db:"user_id"`
}

type ImageData struct {
	ID         string    `bson:"_id"`
	Data       []byte    `bson:"data"`
	Filename   string    `bson:"filename"`
	MimeType   string    `bson:"mime_type"`
	Size       int64     `bson:"size"`
	UploadedAt time.Time `bson:"uploaded_at"`
}

var (
	db               *sql.DB
	redisClient      *redis.Client
	mongoClient      *mongo.Client
	imagesCollection *mongo.Collection

	// Deployment metadata
	serviceVersion = os.Getenv("SERVICE_VERSION")
	gitCommitSha   = os.Getenv("GIT_COMMIT_SHA")
	instanceID     = os.Getenv("HOSTNAME")
	environment    = os.Getenv("ENVIRONMENT")

	// Metrics
	metrics struct {
		mu             sync.RWMutex
		requestsTotal  int64
		errorsTotal    int64
		postsCreated   int64
		postsRetrieved int64
		likesToggled   int64
		imagesServed   int64
		totalLatency   time.Duration
		startTime      time.Time
	}

	// Prometheus metrics
	httpRequestsTotal = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "http_requests_total",
			Help: "Total number of HTTP requests",
		},
		[]string{"method", "endpoint", "status", "service", "version", "instance"},
	)

	httpRequestDuration = prometheus.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "http_request_duration_seconds",
			Help:    "HTTP request duration in seconds",
			Buckets: prometheus.DefBuckets,
		},
		[]string{"method", "endpoint", "service", "version", "instance"},
	)

	serviceErrorsTotal = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "service_errors_total",
			Help: "Total number of service errors",
		},
		[]string{"service", "version", "instance", "error_type"},
	)

	serviceUptimeSeconds = prometheus.NewGaugeVec(
		prometheus.GaugeOpts{
			Name: "service_uptime_seconds",
			Help: "Service uptime in seconds",
		},
		[]string{"service", "version", "instance"},
	)

	businessPostsCreatedTotal = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "business_posts_created_total",
			Help: "Total number of posts created",
		},
		[]string{"service", "version", "instance"},
	)

	businessLikesTotal = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "business_likes_total",
			Help: "Total number of likes",
		},
		[]string{"service", "version", "instance"},
	)
)

func main() {
	// Initialize tracing first
	initTracing()

	// Initialize deployment metadata defaults
	if serviceVersion == "" {
		serviceVersion = "1.0.0"
	}
	if gitCommitSha == "" {
		gitCommitSha = "unknown"
	}
	if instanceID == "" {
		instanceID = "localhost"
	}
	if environment == "" {
		environment = "dev"
	}

	// Initialize metrics
	metrics.startTime = time.Now()

	// Register Prometheus metrics
	prometheus.MustRegister(httpRequestsTotal)
	prometheus.MustRegister(httpRequestDuration)
	prometheus.MustRegister(serviceErrorsTotal)
	prometheus.MustRegister(serviceUptimeSeconds)
	prometheus.MustRegister(businessPostsCreatedTotal)
	prometheus.MustRegister(businessLikesTotal)

	initDB()
	initRedis()
	initMongo()

	r := gin.Default()
	r.Use(requestid.New())
	r.Use(tracingMiddleware())
	r.Use(LoggingMiddleware())
	r.Use(corsMiddleware())
	r.Use(metricsMiddleware())
	r.Use(prometheusMiddleware())

	// Routes
	r.GET("/health", healthCheck)
	r.GET("/metrics", getMetrics)
	r.GET("/prometheus", gin.WrapH(promhttp.Handler()))
	r.POST("/api/posts", authMiddleware(), createPost)
	r.GET("/api/posts", getPosts)
	r.GET("/api/posts/:id", getPost)
	r.DELETE("/api/posts/:id", authMiddleware(), deletePost)
	r.POST("/api/posts/:id/like", authMiddleware(), toggleLike)
	r.GET("/api/posts/user/:username", getUserPosts)
	r.GET("/api/posts/my", authMiddleware(), getMyPosts)
	r.GET("/api/images/:id", getImage)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8083"
	}

	log.Printf("Posts service starting on port %s", port)
	r.Run(":" + port)
}

func initDB() {
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		dbURL = "postgres://postgres:password@postgres:5432/userdb?sslmode=disable"
	}

	var err error
	db, err = sql.Open("postgres", dbURL)
	if err != nil {
		log.Fatal("Failed to connect to database:", err)
	}

	createTables()
	log.Println("Connected to PostgreSQL")
}

func initRedis() {
	redisURL := os.Getenv("REDIS_URL")
	if redisURL == "" {
		redisURL = "redis:6379"
	}

	redisClient = redis.NewClient(&redis.Options{
		Addr: redisURL,
	})

	ctx := context.Background()
	_, err := redisClient.Ping(ctx).Result()
	if err != nil {
		log.Printf("Redis connection failed: %v", err)
	} else {
		log.Println("Connected to Redis")
	}
}

func initMongo() {
	mongoURI := os.Getenv("MONGODB_URI")
	if mongoURI == "" {
		mongoURI = "mongodb://mongodb:27017"
	}

	var err error
	mongoClient, err = mongo.Connect(context.Background(), options.Client().ApplyURI(mongoURI))
	if err != nil {
		log.Fatal("Failed to connect to MongoDB:", err)
	}

	imagesCollection = mongoClient.Database("postsdb").Collection("images")
	log.Println("Connected to MongoDB")
}

func createTables() {
	queries := []string{
		`CREATE TABLE IF NOT EXISTS posts (
			id SERIAL PRIMARY KEY,
			user_id INTEGER NOT NULL,
			username VARCHAR(255) NOT NULL,
			caption TEXT,
			image_url VARCHAR(500),
			image_id VARCHAR(255),
			likes_count INTEGER DEFAULT 0,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
		)`,
		`CREATE TABLE IF NOT EXISTS post_likes (
			id SERIAL PRIMARY KEY,
			post_id INTEGER REFERENCES posts(id) ON DELETE CASCADE,
			user_id INTEGER NOT NULL,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			UNIQUE(post_id, user_id)
		)`,
	}

	for _, query := range queries {
		if _, err := db.Exec(query); err != nil {
			log.Printf("Error creating table: %v", err)
		}
	}
}

func tracingMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		defer func() {
			if r := recover(); r != nil {
				log.Printf("Tracing middleware panic: %v", r)
			}
		}()

		// Extract trace context from headers
		ctx := otel.GetTextMapPropagator().Extract(c.Request.Context(), propagation.HeaderCarrier(c.Request.Header))

		// Start span
		tracer := getTracer()
		ctx, span := tracer.Start(ctx, c.Request.Method+" "+c.FullPath())
		defer span.End()

		// Set span attributes
		span.SetAttributes(
			attribute.String("http.method", c.Request.Method),
			attribute.String("http.url", c.Request.URL.String()),
			attribute.String("http.route", c.FullPath()),
		)

		// Store context in gin context
		c.Request = c.Request.WithContext(ctx)

		c.Next()

		// Set response status
		span.SetAttributes(attribute.Int("http.status_code", c.Writer.Status()))
	}
}

func corsMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Header("Access-Control-Allow-Origin", "*")
		c.Header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		c.Header("Access-Control-Allow-Headers", "Origin, Content-Type, Authorization")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}

		c.Next()
	}
}

func authMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.JSON(401, gin.H{"error": "Authorization header required"})
			c.Abort()
			return
		}

		tokenString := strings.Replace(authHeader, "Bearer ", "", 1)

		// Verify token with user service
		userServiceURL := os.Getenv("USER_SERVICE_URL")
		if userServiceURL == "" {
			userServiceURL = "http://user-service:8080"
		}

		req, _ := http.NewRequest("GET", userServiceURL+"/api/users/validate", nil)
		req.Header.Set("Authorization", "Bearer "+tokenString)

		client := &http.Client{Timeout: 5 * time.Second}
		resp, err := client.Do(req)
		if err != nil || resp.StatusCode != 200 {
			c.JSON(401, gin.H{"error": "Invalid token"})
			c.Abort()
			return
		}

		var result map[string]interface{}
		json.NewDecoder(resp.Body).Decode(&result)

		// Safe type conversion
		userID := 0
		username := ""

		if uid, ok := result["userId"]; ok && uid != nil {
			if uidFloat, ok := uid.(float64); ok {
				userID = int(uidFloat)
			}
		}

		if uname, ok := result["username"]; ok && uname != nil {
			if unameStr, ok := uname.(string); ok {
				username = unameStr
			}
		}

		if userID == 0 || username == "" {
			c.JSON(401, gin.H{"error": "Invalid token data"})
			c.Abort()
			return
		}

		c.Set("user_id", userID)
		c.Set("username", username)
		c.Next()
	}
}

func healthCheck(c *gin.Context) {
	c.JSON(200, gin.H{
		"status":    "OK",
		"service":   "posts-service",
		"timestamp": time.Now(),
	})
}

func metricsMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()

		c.Next()

		duration := time.Since(start)

		metrics.mu.Lock()
		metrics.requestsTotal++
		metrics.totalLatency += duration
		if c.Writer.Status() >= 400 {
			metrics.errorsTotal++
		}
		metrics.mu.Unlock()
	}
}

func prometheusMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()

		c.Next()

		duration := time.Since(start)
		status := strconv.Itoa(c.Writer.Status())

		// Update Prometheus metrics
		httpRequestsTotal.WithLabelValues(
			c.Request.Method,
			c.FullPath(),
			status,
			"posts-service",
			serviceVersion,
			instanceID,
		).Inc()

		httpRequestDuration.WithLabelValues(
			c.Request.Method,
			c.FullPath(),
			"posts-service",
			serviceVersion,
			instanceID,
		).Observe(duration.Seconds())

		if c.Writer.Status() >= 400 {
			serviceErrorsTotal.WithLabelValues(
				"posts-service",
				serviceVersion,
				instanceID,
				"http_error",
			).Inc()
		}

		// Update uptime
		serviceUptimeSeconds.WithLabelValues(
			"posts-service",
			serviceVersion,
			instanceID,
		).Set(time.Since(metrics.startTime).Seconds())
	}
}

func getMetrics(c *gin.Context) {
	metrics.mu.RLock()
	defer metrics.mu.RUnlock()

	uptime := time.Since(metrics.startTime)
	var avgLatency float64
	if metrics.requestsTotal > 0 {
		avgLatency = float64(metrics.totalLatency.Nanoseconds()) / float64(metrics.requestsTotal) / 1000000
	}

	// Get memory stats
	var m runtime.MemStats
	runtime.ReadMemStats(&m)

	// Get database stats
	dbStats := db.Stats()

	// Get posts count
	var postsCount int64
	db.QueryRow("SELECT COUNT(*) FROM posts").Scan(&postsCount)

	// Get likes count
	var likesCount int64
	db.QueryRow("SELECT COUNT(*) FROM post_likes").Scan(&likesCount)

	c.JSON(200, gin.H{
		"service":        "posts-service",
		"timestamp":      time.Now(),
		"uptime_seconds": uptime.Seconds(),
		"deployment": gin.H{
			"version":     serviceVersion,
			"commit_sha":  gitCommitSha,
			"instance_id": instanceID,
			"environment": environment,
		},
		"requests_total":  metrics.requestsTotal,
		"errors_total":    metrics.errorsTotal,
		"posts_created":   metrics.postsCreated,
		"posts_retrieved": metrics.postsRetrieved,
		"likes_toggled":   metrics.likesToggled,
		"images_served":   metrics.imagesServed,
		"avg_latency_ms":  avgLatency,
		"memory_alloc_mb": float64(m.Alloc) / 1024 / 1024,
		"memory_sys_mb":   float64(m.Sys) / 1024 / 1024,
		"goroutines":      runtime.NumGoroutine(),
		"database": gin.H{
			"open_connections": dbStats.OpenConnections,
			"in_use":           dbStats.InUse,
			"idle":             dbStats.Idle,
		},
		"business_metrics": gin.H{
			"total_posts": postsCount,
			"total_likes": likesCount,
		},
	})
}

func createPost(c *gin.Context) {
	userID := c.GetInt("user_id")
	username := c.GetString("username")

	file, header, err := c.Request.FormFile("image")
	if err != nil {
		c.JSON(400, gin.H{"error": "Image file required"})
		return
	}
	defer file.Close()

	caption := c.PostForm("caption")

	// Read image data
	imageData, err := io.ReadAll(file)
	if err != nil {
		c.JSON(500, gin.H{"error": "Failed to read image"})
		return
	}

	// Store image in MongoDB
	imageID := uuid.New().String()
	imageDoc := ImageData{
		ID:         imageID,
		Data:       imageData,
		Filename:   header.Filename,
		MimeType:   header.Header.Get("Content-Type"),
		Size:       header.Size,
		UploadedAt: time.Now(),
	}

	_, err = imagesCollection.InsertOne(context.Background(), imageDoc)
	if err != nil {
		c.JSON(500, gin.H{"error": "Failed to store image"})
		return
	}

	// Create post record
	imageURL := fmt.Sprintf("/api/images/%s", imageID)

	query := `INSERT INTO posts (user_id, username, caption, image_url, image_id) 
			  VALUES ($1, $2, $3, $4, $5) RETURNING id, created_at`

	var post Post
	err = db.QueryRow(query, userID, username, caption, imageURL, imageID).Scan(&post.ID, &post.CreatedAt)
	if err != nil {
		c.JSON(500, gin.H{"error": "Failed to create post"})
		return
	}

	post.UserID = userID
	post.Username = username
	post.Caption = caption
	post.ImageURL = imageURL
	post.ImageID = imageID

	// Update metrics
	metrics.mu.Lock()
	metrics.postsCreated++
	metrics.mu.Unlock()

	// Update Prometheus business metrics
	businessPostsCreatedTotal.WithLabelValues(
		"posts-service",
		serviceVersion,
		instanceID,
	).Inc()

	// Clear cache
	redisClient.Del(context.Background(), "posts:all", "posts:user:"+username)

	c.JSON(201, post)
}

func getPosts(c *gin.Context) {
	// Try cache first
	cached, err := redisClient.Get(context.Background(), "posts:all").Result()
	if err == nil {
		var posts []Post
		json.Unmarshal([]byte(cached), &posts)
		c.JSON(200, posts)
		return
	}

	query := `SELECT id, user_id, username, caption, image_url, image_id, likes_count, created_at, updated_at 
			  FROM posts ORDER BY created_at DESC LIMIT 50`

	rows, err := db.Query(query)
	if err != nil {
		c.JSON(500, gin.H{"error": "Failed to fetch posts"})
		return
	}
	defer rows.Close()

	var posts []Post
	for rows.Next() {
		var post Post
		err := rows.Scan(&post.ID, &post.UserID, &post.Username, &post.Caption,
			&post.ImageURL, &post.ImageID, &post.LikesCount, &post.CreatedAt, &post.UpdatedAt)
		if err != nil {
			continue
		}
		posts = append(posts, post)
	}

	// Cache for 5 minutes
	postsJSON, _ := json.Marshal(posts)
	redisClient.Set(context.Background(), "posts:all", postsJSON, 5*time.Minute)

	// Update metrics
	metrics.mu.Lock()
	metrics.postsRetrieved += int64(len(posts))
	metrics.mu.Unlock()

	c.JSON(200, posts)
}

func getPost(c *gin.Context) {
	id := c.Param("id")

	query := `SELECT id, user_id, username, caption, image_url, image_id, likes_count, created_at, updated_at 
			  FROM posts WHERE id = $1`

	var post Post
	err := db.QueryRow(query, id).Scan(&post.ID, &post.UserID, &post.Username, &post.Caption,
		&post.ImageURL, &post.ImageID, &post.LikesCount, &post.CreatedAt, &post.UpdatedAt)
	if err != nil {
		c.JSON(404, gin.H{"error": "Post not found"})
		return
	}

	c.JSON(200, post)
}

func getUserPosts(c *gin.Context) {
	username := c.Param("username")

	// Try cache first
	cacheKey := "posts:user:" + username
	cached, err := redisClient.Get(context.Background(), cacheKey).Result()
	if err == nil {
		var posts []Post
		json.Unmarshal([]byte(cached), &posts)
		c.JSON(200, posts)
		return
	}

	query := `SELECT id, user_id, username, caption, image_url, image_id, likes_count, created_at, updated_at 
			  FROM posts WHERE username = $1 ORDER BY created_at DESC`

	rows, err := db.Query(query, username)
	if err != nil {
		c.JSON(500, gin.H{"error": "Failed to fetch user posts"})
		return
	}
	defer rows.Close()

	var posts []Post
	for rows.Next() {
		var post Post
		err := rows.Scan(&post.ID, &post.UserID, &post.Username, &post.Caption,
			&post.ImageURL, &post.ImageID, &post.LikesCount, &post.CreatedAt, &post.UpdatedAt)
		if err != nil {
			continue
		}
		posts = append(posts, post)
	}

	// Cache for 2 minutes
	postsJSON, _ := json.Marshal(posts)
	redisClient.Set(context.Background(), cacheKey, postsJSON, 2*time.Minute)

	c.JSON(200, posts)
}

func toggleLike(c *gin.Context) {
	userID := c.GetInt("user_id")
	postID := c.Param("id")

	// Check if already liked
	var existingLike int
	err := db.QueryRow("SELECT id FROM post_likes WHERE post_id = $1 AND user_id = $2", postID, userID).Scan(&existingLike)

	if err == sql.ErrNoRows {
		// Add like
		_, err = db.Exec("INSERT INTO post_likes (post_id, user_id) VALUES ($1, $2)", postID, userID)
		if err != nil {
			c.JSON(500, gin.H{"error": "Failed to add like"})
			return
		}

		// Update likes count
		db.Exec("UPDATE posts SET likes_count = likes_count + 1 WHERE id = $1", postID)
		c.JSON(200, gin.H{"liked": true})
	} else {
		// Remove like
		_, err = db.Exec("DELETE FROM post_likes WHERE post_id = $1 AND user_id = $2", postID, userID)
		if err != nil {
			c.JSON(500, gin.H{"error": "Failed to remove like"})
			return
		}

		// Update likes count
		db.Exec("UPDATE posts SET likes_count = likes_count - 1 WHERE id = $1", postID)
		c.JSON(200, gin.H{"liked": false})
	}

	// Clear cache
	redisClient.Del(context.Background(), "posts:all")

	// Update metrics
	metrics.mu.Lock()
	metrics.likesToggled++
	metrics.mu.Unlock()

	// Update Prometheus business metrics
	businessLikesTotal.WithLabelValues(
		"posts-service",
		serviceVersion,
		instanceID,
	).Inc()
}

func getMyPosts(c *gin.Context) {
	userID := c.GetInt("user_id")

	query := `SELECT id, user_id, username, caption, image_url, image_id, likes_count, created_at, updated_at 
			  FROM posts WHERE user_id = $1 ORDER BY created_at DESC`

	rows, err := db.Query(query, userID)
	if err != nil {
		c.JSON(500, gin.H{"error": "Failed to fetch user posts"})
		return
	}
	defer rows.Close()

	var posts []Post
	for rows.Next() {
		var post Post
		err := rows.Scan(&post.ID, &post.UserID, &post.Username, &post.Caption,
			&post.ImageURL, &post.ImageID, &post.LikesCount, &post.CreatedAt, &post.UpdatedAt)
		if err != nil {
			continue
		}
		posts = append(posts, post)
	}

	c.JSON(200, posts)
}

func deletePost(c *gin.Context) {
	userID := c.GetInt("user_id")
	postID := c.Param("id")

	// Check if post exists and belongs to user
	var post Post
	err := db.QueryRow("SELECT id, user_id, image_id FROM posts WHERE id = $1", postID).Scan(&post.ID, &post.UserID, &post.ImageID)
	if err != nil {
		c.JSON(404, gin.H{"error": "Post not found"})
		return
	}

	if post.UserID != userID {
		c.JSON(403, gin.H{"error": "You can only delete your own posts"})
		return
	}

	// Delete from database
	_, err = db.Exec("DELETE FROM posts WHERE id = $1", postID)
	if err != nil {
		c.JSON(500, gin.H{"error": "Failed to delete post"})
		return
	}

	// Delete image from MongoDB
	if post.ImageID != "" {
		imagesCollection.DeleteOne(context.Background(), bson.M{"_id": post.ImageID})
	}

	// Clear cache
	redisClient.Del(context.Background(), "posts:all")

	c.JSON(200, gin.H{"message": "Post deleted successfully"})
}

func getImage(c *gin.Context) {
	imageID := c.Param("id")

	var imageDoc ImageData
	err := imagesCollection.FindOne(context.Background(), bson.M{"_id": imageID}).Decode(&imageDoc)
	if err != nil {
		c.JSON(404, gin.H{"error": "Image not found"})
		return
	}

	// Update metrics
	metrics.mu.Lock()
	metrics.imagesServed++
	metrics.mu.Unlock()

	c.Header("Content-Type", imageDoc.MimeType)
	c.Header("Content-Length", strconv.FormatInt(imageDoc.Size, 10))
	c.Data(200, imageDoc.MimeType, imageDoc.Data)
}
