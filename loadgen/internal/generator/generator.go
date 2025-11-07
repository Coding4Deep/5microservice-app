package generator

import (
	"context"
	"fmt"
	"log"
	"strconv"
	"strings"
	"sync"
	"time"

	"loadgen/internal/cleanup"
	"loadgen/internal/config"
	"loadgen/internal/metrics"
	"loadgen/internal/user"
)

type Generator struct {
	config   *config.Config
	users    int
	duration time.Duration
	rampRate int
	cleanup  *cleanup.Cleanup
}

func New(cfg *config.Config, users int, duration time.Duration, ramp string, cl *cleanup.Cleanup) *Generator {
	// Parse ramp rate (e.g., "10/s" -> 10)
	parts := strings.Split(ramp, "/")
	rate, _ := strconv.Atoi(parts[0])

	return &Generator{
		config:   cfg,
		users:    users,
		duration: duration,
		rampRate: rate,
		cleanup:  cl,
	}
}

func (g *Generator) Run(ctx context.Context) {
	ctx, cancel := context.WithTimeout(ctx, g.duration)
	defer cancel()

	var wg sync.WaitGroup
	userChan := make(chan int, g.users)

	// Start user goroutines
	for i := 0; i < g.users; i++ {
		wg.Add(1)
		go func(userID int) {
			defer wg.Done()
			<-userChan // Wait for ramp-up signal

			u := user.New(userID, g.config)
			g.cleanup.AddUser(u.Username) // Track user for potential cleanup later
			u.Run(ctx)
		}(i)
	}

	// Ramp up users
	go g.rampUp(ctx, userChan)

	// Wait for completion or timeout
	done := make(chan struct{})
	go func() {
		wg.Wait()
		close(done)
	}()

	select {
	case <-done:
		fmt.Println("All users completed")
	case <-ctx.Done():
		fmt.Println("Test duration reached")
	}

	// NO automatic cleanup - users and data persist as real load
	trackedUsers := g.cleanup.GetTrackedUsers()
	fmt.Printf("✅ Load test completed. %d users and their data remain as persistent load.\n", len(trackedUsers))
}

func (g *Generator) GetTrackedUsers() []string {
	return g.cleanup.GetTrackedUsers()
}

func (g *Generator) rampUp(ctx context.Context, userChan chan int) {
	if g.rampRate <= 0 {
		// Start all users immediately
		for i := 0; i < g.users; i++ {
			select {
			case userChan <- i:
				metrics.ActiveUsers.Inc()
			case <-ctx.Done():
				return
			}
		}
		return
	}

	ticker := time.NewTicker(time.Second / time.Duration(g.rampRate))
	defer ticker.Stop()

	started := 0
	for started < g.users {
		select {
		case <-ticker.C:
			userChan <- started
			metrics.ActiveUsers.Inc()
			started++
			log.Printf("Started user %d/%d", started, g.users)
		case <-ctx.Done():
			return
		}
	}
}
