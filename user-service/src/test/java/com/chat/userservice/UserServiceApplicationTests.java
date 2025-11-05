package com.chat.userservice;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

@SpringBootTest
@ActiveProfiles("test")
class UserServiceApplicationTests {

    @Test
    void contextLoads() {
        // Test that Spring context loads successfully
    }

    @Test
    void applicationStarts() {
        // Simple test to verify application can start
        assert true;
    }
}
