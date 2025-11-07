package cleanup

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"math/rand"
	"net/http"
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
	deletedUsers := c.cleanupUsers(ctx, selectedUsers)

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
// Returns the number of successful deletions.
func (c *Cleanup) cleanupUsers(ctx context.Context, users []string) int {
	deleted := 0
	for _, u := range users {
		url := c.config.Services.UserService.BaseURL + "/api/users/" + u
		log.Printf("➡️ Deleting user via: %s", url)
		req, _ := http.NewRequestWithContext(ctx, "DELETE", url, nil)
		resp, err := c.client.Do(req)
		if err != nil {
			log.Printf("⚠️ Failed to delete user %s: %v", u, err)
			continue
		}
		// Read and close body for better diagnostics
		body, _ := io.ReadAll(resp.Body)
		resp.Body.Close()
		log.Printf("⬅️ Response for DELETE %s: status=%d body=%s", url, resp.StatusCode, string(body))
		if resp.StatusCode == http.StatusOK || resp.StatusCode == http.StatusNoContent {
			deleted++
			log.Printf("✅ Deleted user account: %s", u)
		} else {
			log.Printf("⚠️ Could not delete user %s, status: %d", u, resp.StatusCode)
		}
	}
	return deleted
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
