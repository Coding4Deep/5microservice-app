package com.chat.userservice.controller;

import com.chat.userservice.config.TestSecurityConfig;
import com.chat.userservice.entity.User;
import com.chat.userservice.service.UserService;
import com.chat.userservice.util.JwtUtil;
import com.chat.userservice.metrics.MetricsService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.time.LocalDateTime;
import java.util.*;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(UserController.class)
@Import(TestSecurityConfig.class)
class UserControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private UserService userService;

    @MockBean
    private JwtUtil jwtUtil;

    @MockBean
    private MetricsService metricsService;

    @Autowired
    private ObjectMapper objectMapper;

    private User testUser;

    @BeforeEach
    void setUp() {
        testUser = new User();
        testUser.setId(1L);
        testUser.setUsername("testuser");
        testUser.setEmail("test@example.com");
        testUser.setPassword("hashedpassword");
        testUser.setActive(true);
        testUser.setCreatedAt(LocalDateTime.now());
    }

    // Registration Tests
    @Test
    void registerUser_ValidInput_ReturnsSuccess() throws Exception {
        // Arrange
        Map<String, String> request = Map.of(
            "username", "newuser",
            "email", "new@example.com",
            "password", "password123"
        );
        when(userService.registerUser(anyString(), anyString(), anyString())).thenReturn(testUser);

        // Act & Assert
        mockMvc.perform(post("/api/users/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("User registered successfully"))
                .andExpect(jsonPath("$.userId").value(1));
    }

    @Test
    void registerUser_DuplicateUsername_ReturnsBadRequest() throws Exception {
        // Arrange
        Map<String, String> request = Map.of(
            "username", "existinguser",
            "email", "new@example.com",
            "password", "password123"
        );
        when(userService.registerUser(anyString(), anyString(), anyString()))
                .thenThrow(new RuntimeException("Username already exists"));

        // Act & Assert
        mockMvc.perform(post("/api/users/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("Username already exists"));
    }

    @Test
    void registerUser_InvalidEmail_ReturnsBadRequest() throws Exception {
        // Arrange
        Map<String, String> request = Map.of(
            "username", "newuser",
            "email", "invalid-email",
            "password", "password123"
        );
        when(userService.registerUser(anyString(), anyString(), anyString()))
                .thenThrow(new RuntimeException("Invalid email format"));

        // Act & Assert
        mockMvc.perform(post("/api/users/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("Invalid email format"));
    }

    @Test
    void registerUser_MissingFields_ReturnsBadRequest() throws Exception {
        // Arrange
        Map<String, String> request = Map.of("username", "newuser");

        // Act & Assert
        mockMvc.perform(post("/api/users/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest());
    }

    // Login Tests
    @Test
    void loginUser_ValidCredentials_ReturnsToken() throws Exception {
        // Arrange
        Map<String, String> request = Map.of(
            "username", "testuser",
            "password", "password123"
        );
        when(userService.authenticateUser(anyString(), anyString())).thenReturn(Optional.of(testUser));
        when(jwtUtil.generateToken(anyString())).thenReturn("mock-jwt-token");

        // Act & Assert
        mockMvc.perform(post("/api/users/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.userId").value(1))
                .andExpect(jsonPath("$.token").value("mock-jwt-token"))
                .andExpect(jsonPath("$.username").value("testuser"));
    }

    @Test
    void loginUser_InvalidCredentials_ReturnsBadRequest() throws Exception {
        // Arrange
        Map<String, String> request = Map.of(
            "username", "testuser",
            "password", "wrongpassword"
        );
        when(userService.authenticateUser(anyString(), anyString())).thenReturn(Optional.empty());

        // Act & Assert
        mockMvc.perform(post("/api/users/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("Invalid credentials"));
    }

    @Test
    void loginUser_EmptyCredentials_ReturnsBadRequest() throws Exception {
        // Arrange
        Map<String, String> request = Map.of("username", "", "password", "");

        // Act & Assert
        mockMvc.perform(post("/api/users/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest());
    }

    // Dashboard Tests
    @Test
    void getDashboard_ValidRequest_ReturnsData() throws Exception {
        // Arrange
        List<User> users = Arrays.asList(testUser);
        when(userService.getAllUsers()).thenReturn(users);
        when(userService.getTotalUsers()).thenReturn(10L);
        when(userService.getActiveUsers()).thenReturn(8L);

        // Act & Assert
        mockMvc.perform(get("/api/users/dashboard")
                .header("Authorization", "Bearer mock-token"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalUsers").value(10))
                .andExpect(jsonPath("$.activeUsers").value(8))
                .andExpect(jsonPath("$.users").isArray());
    }

    // Token Validation Tests
    @Test
    void validateToken_ValidToken_ReturnsValid() throws Exception {
        // Arrange
        when(jwtUtil.isTokenValid(anyString())).thenReturn(true);
        when(jwtUtil.extractUsername(anyString())).thenReturn("testuser");
        when(userService.getUserByUsername(anyString())).thenReturn(Optional.of(testUser));

        // Act & Assert
        mockMvc.perform(get("/api/users/validate")
                .header("Authorization", "Bearer mock-token"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.valid").value(true))
                .andExpect(jsonPath("$.username").value("testuser"));
    }

    @Test
    void validateToken_InvalidToken_ReturnsInvalid() throws Exception {
        // Arrange
        when(jwtUtil.isTokenValid(anyString())).thenReturn(false);

        // Act & Assert
        mockMvc.perform(get("/api/users/validate")
                .header("Authorization", "Bearer invalid-token"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.valid").value(false));
    }

    @Test
    void validateToken_MissingToken_ReturnsUnauthorized() throws Exception {
        // Act & Assert
        mockMvc.perform(get("/api/users/validate"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void validateToken_ExpiredToken_ReturnsInvalid() throws Exception {
        // Arrange
        when(jwtUtil.isTokenValid(anyString())).thenReturn(false);

        // Act & Assert
        mockMvc.perform(get("/api/users/validate")
                .header("Authorization", "Bearer expired-token"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.valid").value(false));
    }
}
