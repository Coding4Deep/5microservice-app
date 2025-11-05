package com.chat.userservice.util;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
@ActiveProfiles("test")
class JwtUtilTest {

    @Autowired
    private JwtUtil jwtUtil;

    @Test
    void generateToken_Success() {
        String username = "testuser";

        String token = jwtUtil.generateToken(username);

        assertNotNull(token);
        assertFalse(token.isEmpty());
    }

    @Test
    void extractUsername_Success() {
        String username = "testuser";
        String token = jwtUtil.generateToken(username);

        String extractedUsername = jwtUtil.extractUsername(token);

        assertEquals(username, extractedUsername);
    }

    @Test
    void isTokenValid_ValidToken() {
        String username = "testuser";
        String token = jwtUtil.generateToken(username);

        boolean isValid = jwtUtil.isTokenValid(token);

        assertTrue(isValid);
    }

    @Test
    void isTokenValid_InvalidToken() {
        String invalidToken = "invalid.token.here";

        boolean isValid = jwtUtil.isTokenValid(invalidToken);

        assertFalse(isValid);
    }

    @Test
    void isTokenValid_NullToken() {
        boolean isValid = jwtUtil.isTokenValid(null);

        assertFalse(isValid);
    }

    @Test
    void isTokenValid_EmptyToken() {
        boolean isValid = jwtUtil.isTokenValid("");

        assertFalse(isValid);
    }
}
