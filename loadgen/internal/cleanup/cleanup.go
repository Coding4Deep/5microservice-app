package cleanup

import (
	"context"
	"encoding/json"
	"fmt"
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
	
	// Randomly select users to delete
	selectedUsers := make([]string, usersToDelete)
	copy(selectedUsers, c.users[:usersToDelete])
	
	// Shuffle for random selection
	for i := range selectedUsers {
		j := rand.Intn(len(c.users))
		if j < len(selectedUsers) {
			selectedUsers[i] = c.users[j]
		}
	}

	deletedCount := 0
	
	// Clean chat messages from selected users
	deletedCount += c.cleanupChatMessagesFromUsers(ctx, selectedUsers)
	
	// Clean posts from selected users
	deletedCount += c.cleanupPostsFromUsers(ctx, selectedUsers)
	
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
	
	log.Printf("✅ Load reduction completed: %d users and their data removed, %d users remain", usersToDelete, len(c.users))
	return usersToDelete
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
