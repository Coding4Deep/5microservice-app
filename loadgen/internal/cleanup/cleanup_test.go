package cleanup

import (
    "context"
    "encoding/json"
    "net/http"
    "net/http/httptest"
    "testing"
    "time"

    "loadgen/internal/config"
)

func TestDeleteTestUsers_PartialFailures(t *testing.T) {
    // Setup a test server that simulates the user-service
    mux := http.NewServeMux()
    mux.HandleFunc("/api/users/dashboard", func(w http.ResponseWriter, r *http.Request) {
        resp := map[string]interface{}{"users": []string{"user_1", "user_2", "bob", "user_3"}}
        w.Header().Set("Content-Type", "application/json")
        json.NewEncoder(w).Encode(resp)
    })

    mux.HandleFunc("/api/users/user_1", func(w http.ResponseWriter, r *http.Request) {
        if r.Method == "DELETE" {
            w.Header().Set("Content-Type", "application/json")
            w.WriteHeader(200)
            json.NewEncoder(w).Encode(map[string]interface{}{"deleted": true, "username": "user_1"})
            return
        }
        http.NotFound(w, r)
    })

    mux.HandleFunc("/api/users/user_2", func(w http.ResponseWriter, r *http.Request) {
        if r.Method == "DELETE" {
            w.Header().Set("Content-Type", "application/json")
            w.WriteHeader(500)
            json.NewEncoder(w).Encode(map[string]interface{}{"error": "internal"})
            return
        }
        http.NotFound(w, r)
    })

    mux.HandleFunc("/api/users/user_3", func(w http.ResponseWriter, r *http.Request) {
        if r.Method == "DELETE" {
            w.Header().Set("Content-Type", "application/json")
            w.WriteHeader(200)
            json.NewEncoder(w).Encode(map[string]interface{}{"deleted": true, "username": "user_3"})
            return
        }
        http.NotFound(w, r)
    })

    ts := httptest.NewServer(mux)
    defer ts.Close()

    cfg := &config.Config{}
    cfg.Services.UserService.BaseURL = ts.URL

    c := New(cfg)

    ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
    defer cancel()

    deleted, failed := c.DeleteTestUsers(ctx, 10)

    // Check that user_1 and user_3 are in deleted, and user_2 is in failed
    found1, found3 := false, false
    for _, d := range deleted {
        if d == "user_1" {
            found1 = true
        }
        if d == "user_3" {
            found3 = true
        }
    }
    if !found1 || !found3 {
        t.Fatalf("expected user_1 and user_3 to be deleted, got deleted=%v", deleted)
    }

    if code, ok := failed["user_2"]; !ok || code != 500 {
        t.Fatalf("expected user_2 to fail with 500, got failed=%v", failed)
    }
}
