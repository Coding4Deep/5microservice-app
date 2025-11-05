package com.chat.userservice.config;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

@SpringBootTest
@ActiveProfiles("test")
public class SecurityConfigTest {

    @Test
    public void contextLoads() {
        // Test that security configuration loads without errors
    }
}
