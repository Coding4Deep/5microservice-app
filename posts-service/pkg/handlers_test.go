package handlers

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestHealthHandler(t *testing.T) {
	req, err := http.NewRequest("GET", "/health", nil)
	if err != nil {
		t.Fatal(err)
	}

	rr := httptest.NewRecorder()
	handler := http.HandlerFunc(HealthHandler)
	handler.ServeHTTP(rr, req)

	if status := rr.Code; status != http.StatusOK {
		t.Errorf("handler returned wrong status code: got %v want %v", status, http.StatusOK)
	}

	var response map[string]interface{}
	if err := json.Unmarshal(rr.Body.Bytes(), &response); err != nil {
		t.Fatal(err)
	}

	if response["status"] != "OK" {
		t.Errorf("Expected status OK, got %v", response["status"])
	}
}

func TestGetPosts(t *testing.T) {
	ResetPosts()

	req, err := http.NewRequest("GET", "/api/posts", nil)
	if err != nil {
		t.Fatal(err)
	}

	rr := httptest.NewRecorder()
	handler := http.HandlerFunc(GetPosts)
	handler.ServeHTTP(rr, req)

	if status := rr.Code; status != http.StatusOK {
		t.Errorf("handler returned wrong status code: got %v want %v", status, http.StatusOK)
	}

	var result []Post
	if err := json.Unmarshal(rr.Body.Bytes(), &result); err != nil {
		t.Fatal(err)
	}

	if len(result) != 0 {
		t.Errorf("Expected empty posts array, got %d posts", len(result))
	}
}

func TestCreatePost(t *testing.T) {
	ResetPosts()

	postData := Post{
		Title:   "Test Post",
		Content: "Test Content",
		Author:  "Test Author",
	}

	jsonData, _ := json.Marshal(postData)
	req, err := http.NewRequest("POST", "/api/posts", bytes.NewBuffer(jsonData))
	if err != nil {
		t.Fatal(err)
	}
	req.Header.Set("Content-Type", "application/json")

	rr := httptest.NewRecorder()
	handler := http.HandlerFunc(CreatePost)
	handler.ServeHTTP(rr, req)

	if status := rr.Code; status != http.StatusCreated {
		t.Errorf("handler returned wrong status code: got %v want %v", status, http.StatusCreated)
	}

	var result Post
	if err := json.Unmarshal(rr.Body.Bytes(), &result); err != nil {
		t.Fatal(err)
	}

	if result.Title != "Test Post" {
		t.Errorf("Expected title 'Test Post', got %v", result.Title)
	}

	if result.ID != 1 {
		t.Errorf("Expected ID 1, got %v", result.ID)
	}
}

func TestLikePost(t *testing.T) {
	ResetPosts()
	posts = []Post{
		{ID: 1, Title: "Test", Content: "Test", Author: "Test", Likes: 0},
	}

	req, err := http.NewRequest("POST", "/api/posts/like?id=1", nil)
	if err != nil {
		t.Fatal(err)
	}

	rr := httptest.NewRecorder()
	handler := http.HandlerFunc(LikePost)
	handler.ServeHTTP(rr, req)

	if status := rr.Code; status != http.StatusOK {
		t.Errorf("handler returned wrong status code: got %v want %v", status, http.StatusOK)
	}

	var result Post
	if err := json.Unmarshal(rr.Body.Bytes(), &result); err != nil {
		t.Fatal(err)
	}

	if result.Likes != 1 {
		t.Errorf("Expected 1 like, got %v", result.Likes)
	}
}

func TestGetImage(t *testing.T) {
	req, err := http.NewRequest("GET", "/api/image", nil)
	if err != nil {
		t.Fatal(err)
	}

	rr := httptest.NewRecorder()
	handler := http.HandlerFunc(GetImage)
	handler.ServeHTTP(rr, req)

	if status := rr.Code; status != http.StatusOK {
		t.Errorf("handler returned wrong status code: got %v want %v", status, http.StatusOK)
	}
}
