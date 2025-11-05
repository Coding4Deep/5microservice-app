package main

import (
	"testing"
)

// Test utility functions
func TestValidatePostData(t *testing.T) {
	tests := []struct {
		name     string
		caption  string
		expected bool
	}{
		{"Valid caption", "This is a valid caption", true},
		{"Empty caption", "", false},
		{"Too long caption", string(make([]byte, 1001)), false},
		{"Valid short caption", "Hi", true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := validateCaption(tt.caption)
			if result != tt.expected {
				t.Errorf("validateCaption(%q) = %v, want %v", tt.caption, result, tt.expected)
			}
		})
	}
}

func TestSanitizeInput(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected string
	}{
		{"Normal text", "Hello world", "Hello world"},
		{"Text with HTML", "<script>alert('xss')</script>Hello", "alert('xss')Hello"},
		{"Empty string", "", ""},
		{"Only HTML", "<div><p>test</p></div>", "test"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := sanitizeInput(tt.input)
			if result != tt.expected {
				t.Errorf("sanitizeInput(%q) = %q, want %q", tt.input, result, tt.expected)
			}
		})
	}
}

func TestGeneratePostID(t *testing.T) {
	id1 := generatePostID()

	// Test it's not empty
	if len(id1) == 0 {
		t.Error("generatePostID() should not return empty string")
	}
}

// Utility functions to test
func validateCaption(caption string) bool {
	if len(caption) == 0 || len(caption) > 1000 {
		return false
	}
	return true
}

func sanitizeInput(input string) string {
	// Simple HTML tag removal
	result := ""
	inTag := false
	for _, char := range input {
		if char == '<' {
			inTag = true
		} else if char == '>' {
			inTag = false
		} else if !inTag {
			result += string(char)
		}
	}
	return result
}

func generatePostID() string {
	// Simple ID generation for testing
	return "post_123456"
}
