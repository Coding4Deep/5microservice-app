package com.chat.userservice.service;

import com.chat.userservice.entity.User;
import com.chat.userservice.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.BeforeEach;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.MockitoAnnotations;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Optional;
import java.util.Arrays;

import static org.mockito.Mockito.*;
import static org.junit.jupiter.api.Assertions.*;

class UserServiceTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private PasswordEncoder passwordEncoder;

    @InjectMocks
    private UserService userService;

    @BeforeEach
    void setUp() {
        MockitoAnnotations.openMocks(this);
    }

    @Test
    void testUpdateUserActivity() {
        User user = new User("test", "test@test.com", "password");
        when(userRepository.findByUsername("test")).thenReturn(Optional.of(user));

        userService.updateUserActivity("test", true);

        verify(userRepository).save(user);
        assertTrue(user.isActive());
    }

    @Test
    void testGetUserByUsername() {
        User user = new User("test", "test@test.com", "password");
        when(userRepository.findByUsername("test")).thenReturn(Optional.of(user));

        Optional<User> result = userService.getUserByUsername("test");

        assertTrue(result.isPresent());
        assertEquals("test", result.get().getUsername());
    }
}
