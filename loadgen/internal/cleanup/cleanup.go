package cleanup

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"math/rand"
	"net/http"
	"strings"
	"sync"
	"time"

	"loadgen/internal/config"
)

type Cleanup struct {
	config *config.Config
	client *http.Client
	users  []string
}

func New(cfg *config.Config) *Cleanup {
	return &Cleanup{
		config: cfg,
		client: &http.Client{Timeout: 10 * time.Second},
		users:  make([]string, 0),
	}
}

func (c *Cleanup) AddUser(username string) {
	// Avoid duplicates in the tracked users list
	for _, u := range c.users {
		if u == username {
			return
		}
	}
	c.users = append(c.users, username)
}

func (c *Cleanup) GetTrackedUsers() []string {
	return c.users
}

func (c *Cleanup) ReduceLoad(ctx context.Context, usersToDelete int) int {
	if usersToDelete <= 0 || usersToDelete > len(c.users) {
		usersToDelete = len(c.users)
	}

	log.Printf("🔻 Reducing load: deleting %d out of %d load-generated users...", usersToDelete, len(c.users))

	// Select unique users to delete: shuffle the tracked users and take the first N
	all := make([]string, len(c.users))
	copy(all, c.users)
	rand.Shuffle(len(all), func(i, j int) { all[i], all[j] = all[j], all[i] })
	selectedUsers := all
	if usersToDelete < len(all) {
		selectedUsers = all[:usersToDelete]
	}

	// First, attempt to delete user accounts from user-service
	deletedList, _ := c.cleanupUsers(ctx, selectedUsers)
	deletedUsers := len(deletedList)

	// Cleanup chat messages and posts for the selected users (best-effort)
	c.cleanupChatMessagesFromUsers(ctx, selectedUsers)
	c.cleanupPostsFromUsers(ctx, selectedUsers)

	// Remove deleted users from tracking
	remaining := make([]string, 0)
	for _, user := range c.users {
		found := false
		for _, deleted := range selectedUsers {
			if user == deleted {
				found = true
				break
			}
		}
		if !found {
			remaining = append(remaining, user)
		}
	}
	c.users = remaining

	log.Printf("✅ Load reduction completed: %d user accounts removed, %d users remain", deletedUsers, len(c.users))
	return deletedUsers
}

// cleanupUsers sends DELETE requests to the user service for the given usernames.
// Returns a slice of usernames that were successfully deleted and a map of failed usernames to HTTP status codes.
func (c *Cleanup) cleanupUsers(ctx context.Context, users []string) ([]string, map[string]int) {
	deleted := make([]string, 0)
	failed := make(map[string]int)
	for _, u := range users {
		url := c.config.Services.UserService.BaseURL + "/api/users/" + u
		log.Printf("➡️ Deleting user via: %s", url)
		req, _ := http.NewRequestWithContext(ctx, "DELETE", url, nil)
		resp, err := c.client.Do(req)
		if err != nil {
			log.Printf("⚠️ Failed to delete user %s: %v", u, err)
			failed[u] = 0
			continue
		}
		// Read and close body for better diagnostics
		body, _ := io.ReadAll(resp.Body)
		resp.Body.Close()
		log.Printf("⬅️ Response for DELETE %s: status=%d body=%s", url, resp.StatusCode, string(body))
		if resp.StatusCode == http.StatusOK || resp.StatusCode == http.StatusNoContent {
			deleted = append(deleted, u)
			log.Printf("✅ Deleted user account: %s", u)
		} else {
			log.Printf("⚠️ Could not delete user %s, status: %d", u, resp.StatusCode)
			failed[u] = resp.StatusCode
		}
	}
	return deleted, failed
}

// DeleteTestUsers queries the user-service dashboard for users whose usernames start with
// the test user prefix ("user_"), and deletes up to `count` of them. It returns the list
// of usernames that were deleted.
func (c *Cleanup) DeleteTestUsers(ctx context.Context, count int) ([]string, map[string]int) {
	if count <= 0 {
		return []string{}, map[string]int{}
	}

	// Try to fetch user list from user-service dashboard
	dashboardURL := c.config.Services.UserService.BaseURL + "/api/users/dashboard"
	req, _ := http.NewRequestWithContext(ctx, "GET", dashboardURL, nil)
	resp, err := c.client.Do(req)
	if err != nil {
		log.Printf("⚠️ Failed to fetch dashboard: %v", err)
		return []string{}, map[string]int{}
	}
	defer resp.Body.Close()

	var data map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&data); err != nil {
		log.Printf("⚠️ Failed to decode dashboard response: %v", err)
		return []string{}, map[string]int{}
	}

	// Extract users array (if available). Items may be strings or objects with a "username" field.
	candidates := make([]string, 0)
	if ulist, ok := data["users"]; ok {
		if arr, ok := ulist.([]interface{}); ok {
			for _, v := range arr {
				switch it := v.(type) {
				case string:
					if strings.HasPrefix(it, "user_") {
						candidates = append(candidates, it)
					}
				case map[string]interface{}:
					if uname, ok := it["username"].(string); ok {
						if strings.HasPrefix(uname, "user_") {
							candidates = append(candidates, uname)
						}
					}
				}
			}
		}
	}

	// If dashboard didn't return users, fall back to tracked list
	if len(candidates) == 0 {
		for _, u := range c.users {
			if strings.HasPrefix(u, "user_") {
				candidates = append(candidates, u)
			}
		}
	}

	if len(candidates) == 0 {
		log.Printf("ℹ️ No test users found to delete (prefix 'user_')")
		return []string{}, map[string]int{}
	}

	// Ensure uniqueness and deterministic order: shuffle and pick up to count
	uniq := make([]string, 0)
	seen := map[string]bool{}
	for _, s := range candidates {
		if !seen[s] {
			seen[s] = true
			uniq = append(uniq, s)
		}
	}
	rand.Shuffle(len(uniq), func(i, j int) { uniq[i], uniq[j] = uniq[j], uniq[i] })

	toDelete := uniq
	if count < len(uniq) {
		toDelete = uniq[:count]
	}

	// Use existing cleanup path to delete the selected users
	deleted, failed := c.cleanupUsers(ctx, toDelete)

	// Remove deleted users from tracked list if present
	remaining := make([]string, 0)
	delSet := map[string]bool{}
	for _, d := range deleted {
		delSet[d] = true
	}
	for _, u := range c.users {
		if !delSet[u] {
			remaining = append(remaining, u)
		}
	}
	c.users = remaining

	// Log failures for visibility
	if len(failed) > 0 {
		for u, code := range failed {
			log.Printf("⚠️ Failed to delete %s: status=%d", u, code)
		}
	}

	return deleted, failed
}

// DeleteRandomTestUsersConcurrent selects up to `count` test users (username prefix "user_")
// and deletes them concurrently using up to `concurrency` goroutines.
func (c *Cleanup) DeleteRandomTestUsersConcurrent(ctx context.Context, count int, concurrency int) ([]string, map[string]int) {
	if count <= 0 {
		return []string{}, map[string]int{}
	}

	// Fetch dashboard similar to DeleteTestUsers
	dashboardURL := c.config.Services.UserService.BaseURL + "/api/users/dashboard"
	req, _ := http.NewRequestWithContext(ctx, "GET", dashboardURL, nil)
	resp, err := c.client.Do(req)
	if err != nil {
		log.Printf("⚠️ Failed to fetch dashboard: %v", err)
		return []string{}, map[string]int{}
	}
	defer resp.Body.Close()

	var data map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&data); err != nil {
		log.Printf("⚠️ Failed to decode dashboard response: %v", err)
		return []string{}, map[string]int{}
	}

	candidates := make([]string, 0)
	if ulist, ok := data["users"]; ok {
		if arr, ok := ulist.([]interface{}); ok {
			for _, v := range arr {
				switch it := v.(type) {
				case string:
					if strings.HasPrefix(it, "user_") {
						candidates = append(candidates, it)
					}
				case map[string]interface{}:
					if uname, ok := it["username"].(string); ok {
						if strings.HasPrefix(uname, "user_") {
							candidates = append(candidates, uname)
						}
					}
				}
			}
		}
	}

	// fallback to tracked users
	if len(candidates) == 0 {
		for _, u := range c.users {
			if strings.HasPrefix(u, "user_") {
				candidates = append(candidates, u)
			}
		}
	}

	if len(candidates) == 0 {
		log.Printf("ℹ️ No test users found to delete (prefix 'user_')")
		return []string{}, map[string]int{}
	}

	// dedupe and shuffle
	uniq := make([]string, 0)
	seen := map[string]bool{}
	for _, s := range candidates {
		if !seen[s] {
			seen[s] = true
			uniq = append(uniq, s)
		}
	}
	rand.Shuffle(len(uniq), func(i, j int) { uniq[i], uniq[j] = uniq[j], uniq[i] })

	toDelete := uniq
	if count < len(uniq) {
		toDelete = uniq[:count]
	}

	if concurrency <= 0 {
		concurrency = 5
	}
	if concurrency > len(toDelete) {
		concurrency = len(toDelete)
	}

	// concurrent deletion using DeleteUser which also cleans tracked list on success
	var mu sync.Mutex
	deleted := make([]string, 0)
	failed := make(map[string]int)

	sem := make(chan struct{}, concurrency)
	var wg sync.WaitGroup
	for _, u := range toDelete {
		select {
		case <-ctx.Done():
			break
		default:
		}
		wg.Add(1)
		sem <- struct{}{}
		go func(username string) {
			defer wg.Done()
			defer func() { <-sem }()
			d, code := c.DeleteUser(ctx, username)
			mu.Lock()
			defer mu.Unlock()
			if d {
				deleted = append(deleted, username)
			} else {
				failed[username] = code
			}
		}(u)
	}
	wg.Wait()

	// Log failures for visibility
	if len(failed) > 0 {
		for u, code := range failed {
			log.Printf("⚠️ Failed to delete %s: status=%d", u, code)
		}
	}

	return deleted, failed
}

// DeleteUser deletes a single test user by username. Returns (deleted, httpStatus).
func (c *Cleanup) DeleteUser(ctx context.Context, username string) (bool, int) {
	if username == "" || !strings.HasPrefix(username, "user_") {
		return false, http.StatusBadRequest
	}

	deleted, failed := c.cleanupUsers(ctx, []string{username})
	if len(deleted) == 1 {
		// remove from tracked list if present
		remaining := make([]string, 0)
		for _, u := range c.users {
			if u != username {
				remaining = append(remaining, u)
			}
		}
		c.users = remaining
		return true, http.StatusOK
	}
	if code, ok := failed[username]; ok {
		return false, code
	}
	return false, 0
}

func (c *Cleanup) cleanupChatMessagesFromUsers(ctx context.Context, users []string) int {
	// Get all messages
	req, _ := http.NewRequestWithContext(ctx, "GET", c.config.Services.ChatService.BaseURL+"/api/messages", nil)
	resp, err := c.client.Do(req)
	if err != nil {
		return 0
	}
	defer resp.Body.Close()

	var messages []map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&messages)

	deletedCount := 0
	for _, message := range messages {
		if username, ok := message["username"].(string); ok {
			for _, targetUser := range users {
				if username == targetUser {
					// Delete this message
					if id, ok := message["id"]; ok {
						deleteReq, _ := http.NewRequestWithContext(ctx, "DELETE",
							fmt.Sprintf("%s/api/messages/%v", c.config.Services.ChatService.BaseURL, id), nil)
						deleteResp, err := c.client.Do(deleteReq)
						if err == nil {
							deleteResp.Body.Close()
							deletedCount++
						}
					}
					break
				}
			}
		}
	}

	if deletedCount > 0 {
		log.Printf("✅ Cleaned up %d chat messages from selected users", deletedCount)
	}
	return deletedCount
}

func (c *Cleanup) cleanupPostsFromUsers(ctx context.Context, users []string) int {
	// Get all posts
	req, _ := http.NewRequestWithContext(ctx, "GET", c.config.Services.PostsService.BaseURL+"/api/posts", nil)
	resp, err := c.client.Do(req)
	if err != nil {
		return 0
	}
	defer resp.Body.Close()

	var posts []map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&posts)

	deletedCount := 0
	for _, post := range posts {
		if username, ok := post["username"].(string); ok {
			for _, targetUser := range users {
				if username == targetUser {
					// Delete this post
					if id, ok := post["id"]; ok {
						deleteReq, _ := http.NewRequestWithContext(ctx, "DELETE",
							fmt.Sprintf("%s/api/posts/%v", c.config.Services.PostsService.BaseURL, id), nil)
						deleteResp, err := c.client.Do(deleteReq)
						if err == nil {
							deleteResp.Body.Close()
							deletedCount++
						}
					}
					break
				}
			}
		}
	}

	if deletedCount > 0 {
		log.Printf("✅ Cleaned up %d posts from selected users", deletedCount)
	}
	return deletedCount
}
