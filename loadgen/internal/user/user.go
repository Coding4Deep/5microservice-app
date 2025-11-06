package user

import (
	"context"
	"fmt"
	"log"
	"math/rand"
	"time"

	"loadgen/internal/behaviors"
	"loadgen/internal/config"
	"loadgen/internal/metrics"
)

type User struct {
	ID       int
	Username string
	Token    string
	UserID   string
	config   *config.Config
	auth     *behaviors.AuthBehavior
	chat     *behaviors.ChatBehavior
	posts    *behaviors.PostsBehavior
	profile  *behaviors.ProfileBehavior
}

func New(id int, cfg *config.Config) *User {
	username := fmt.Sprintf("user_%d", id)
	
	return &User{
		ID:       id,
		Username: username,
		config:   cfg,
		auth:     behaviors.NewAuth(cfg),
		chat:     behaviors.NewChat(cfg),
		posts:    behaviors.NewPosts(cfg),
		profile:  behaviors.NewProfile(cfg),
	}
}

func (u *User) Run(ctx context.Context) {
	defer metrics.ActiveUsers.Dec()
	
	log.Printf("User %s starting simulation", u.Username)

	// Login/Register
	if err := u.authenticate(ctx); err != nil {
		log.Printf("User %s auth failed: %v", u.Username, err)
		return
	}

	// Start chat connection
	chatDone := make(chan struct{})
	go func() {
		defer close(chatDone)
		u.chat.Connect(ctx, u.Token)
	}()

	// Wait a moment for chat connection
	time.Sleep(2 * time.Second)

	// GUARANTEE: Send at least one chat message per user
	u.sendChatMessage(ctx)

	// Ensure each user uses at least one service per cycle
	serviceUsed := make(map[string]bool)
	serviceUsed["chat"] = true // Already used chat
	cycleCount := 0

	// Main behavior loop
	for {
		select {
		case <-ctx.Done():
			log.Printf("User %s stopping", u.Username)
			return
		default:
			// Reset service tracking every 4 actions
			if cycleCount%4 == 0 {
				serviceUsed = make(map[string]bool)
				// Guarantee another chat message every cycle
				u.sendChatMessage(ctx)
				serviceUsed["chat"] = true
			}

			action := u.selectAction(serviceUsed)
			action(ctx)
			cycleCount++
			
			u.idle()
		}
	}
}

func (u *User) selectAction(serviceUsed map[string]bool) func(context.Context) {
	// Ensure each service gets used
	if !serviceUsed["posts"] && rand.Float32() < 0.4 {
		serviceUsed["posts"] = true
		return u.randomPostsAction
	}
	if !serviceUsed["chat"] && rand.Float32() < 0.3 {
		serviceUsed["chat"] = true
		return u.randomChatAction
	}
	if !serviceUsed["profile"] && rand.Float32() < 0.2 {
		serviceUsed["profile"] = true
		return u.randomProfileAction
	}

	// Random selection with realistic weights
	actions := []struct {
		fn     func(context.Context)
		weight float32
	}{
		{u.randomPostsAction, 0.35},
		{u.randomChatAction, 0.25},
		{u.randomProfileAction, 0.15},
		{u.viewPosts, 0.15},
		{u.readChatMessages, 0.1},
	}

	totalWeight := float32(0)
	for _, a := range actions {
		totalWeight += a.weight
	}

	r := rand.Float32() * totalWeight
	for _, a := range actions {
		r -= a.weight
		if r <= 0 {
			return a.fn
		}
	}
	return u.viewPosts
}

func (u *User) randomProfileAction(ctx context.Context) {
	if rand.Float32() < 0.7 {
		u.updateProfile(ctx)
	} else {
		u.viewProfile(ctx)
	}
}

func (u *User) updateProfile(ctx context.Context) {
	u.profile.UpdateProfile(ctx, u.Token, u.UserID)
}

func (u *User) viewProfile(ctx context.Context) {
	u.profile.GetProfile(ctx, u.Token, u.UserID)
}

func (u *User) randomPostsAction(ctx context.Context) {
	actions := []func(context.Context){
		u.createPost,
		u.likeRandomPost,
		u.viewPosts,
	}
	action := actions[rand.Intn(len(actions))]
	action(ctx)
}

func (u *User) randomChatAction(ctx context.Context) {
	if rand.Float32() < 0.7 {
		u.sendChatMessage(ctx)
	} else {
		u.readChatMessages(ctx)
	}
}

func (u *User) authenticate(ctx context.Context) error {
	// Try login first, register if fails
	token, err := u.auth.Login(ctx, u.Username, "password123")
	if err != nil {
		// Register new user
		if err := u.auth.Register(ctx, u.Username, u.Username+"@example.com", "password123"); err != nil {
			return fmt.Errorf("register failed: %w", err)
		}
		// Login after registration
		token, err = u.auth.Login(ctx, u.Username, "password123")
		if err != nil {
			return fmt.Errorf("login after register failed: %w", err)
		}
	}
	
	u.Token = token
	u.UserID = fmt.Sprintf("%d", u.ID) // Use user ID for profile operations
	log.Printf("User %s authenticated", u.Username)
	return nil
}

func (u *User) performRandomAction(ctx context.Context) {
	actions := []func(context.Context){
		u.viewPosts,
		u.createPost,
		u.likeRandomPost,
		u.sendChatMessage,
		u.readChatMessages,
	}
	
	action := actions[rand.Intn(len(actions))]
	action(ctx)
}

func (u *User) viewPosts(ctx context.Context) {
	u.posts.GetPosts(ctx, u.Token)
}

func (u *User) createPost(ctx context.Context) {
	contents := []string{
		fmt.Sprintf("Just posted from %s! 📝", u.Username),
		fmt.Sprintf("Hello everyone! - %s", u.Username),
		fmt.Sprintf("Testing the app - %s at %s", u.Username, time.Now().Format("15:04")),
		fmt.Sprintf("Random post by %s 🚀", u.Username),
		fmt.Sprintf("%s checking in!", u.Username),
	}
	content := contents[rand.Intn(len(contents))]
	u.posts.CreatePost(ctx, u.Token, content)
}

func (u *User) likeRandomPost(ctx context.Context) {
	// Get posts and like a random one
	posts := u.posts.GetPosts(ctx, u.Token)
	if len(posts) > 0 {
		randomPost := posts[rand.Intn(len(posts))]
		u.posts.LikePost(ctx, u.Token, randomPost.ID)
	}
}

func (u *User) sendChatMessage(ctx context.Context) {
	messages := []string{
		fmt.Sprintf("Hey everyone! %s here 👋", u.Username),
		fmt.Sprintf("%s says hello to the chat!", u.Username),
		fmt.Sprintf("Good day from %s ☀️", u.Username),
		fmt.Sprintf("Testing public chat - %s 💬", u.Username),
		fmt.Sprintf("%s is online and chatting! 🎉", u.Username),
		fmt.Sprintf("Random message from %s at %s", u.Username, time.Now().Format("15:04")),
	}
	message := messages[rand.Intn(len(messages))]
	u.chat.SendMessage(ctx, message)
}

func (u *User) readChatMessages(ctx context.Context) {
	u.chat.GetMessages(ctx)
}

func (u *User) idle() {
	// More realistic idle times: 2-8 seconds
	idleTime := time.Duration(rand.Intn(6)+2) * time.Second
	time.Sleep(idleTime)
}
