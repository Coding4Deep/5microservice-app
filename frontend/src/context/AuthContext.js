import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';
import { addTraceHeaders } from '../utils/tracing';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [username, setUsername] = useState(localStorage.getItem('username'));
  const [loading, setLoading] = useState(true);

  const API_BASE = process.env.REACT_APP_USER_SERVICE_URL || 'http://localhost:8080';

  useEffect(() => {
    const validateToken = async () => {
      if (token) {
        try {
          const response = await axios.get(`${API_BASE}/api/users/validate`, {
            headers: addTraceHeaders({ Authorization: `Bearer ${token}` }),
            timeout: 5000
          });
          if (!response.data.valid) {
            console.log('Token validation failed, logging out');
            logout();
          }
        } catch (error) {
          console.error('Token validation error:', error.message);
          logout();
        }
      }
      setLoading(false);
    };

    validateToken();
  }, [token, API_BASE]);

  const login = async (username, password) => {
    try {
      const response = await axios.post(`${API_BASE}/api/users/login`, {
        username,
        password
      }, {
        headers: addTraceHeaders(),
        timeout: 10000
      });
      
      const { token, username: user, userId } = response.data;
      setToken(token);
      setUsername(user);
      localStorage.setItem('token', token);
      localStorage.setItem('username', user);
      console.log('Login successful for user:', user);
      return { success: true, userId };
    } catch (error) {
      console.error('Login error:', error);
      const errorMessage = error.response?.data?.error || 
                          error.response?.data?.message || 
                          (error.code === 'ECONNREFUSED' ? 'Cannot connect to server' : 'Login failed');
      return { 
        success: false, 
        error: errorMessage
      };
    }
  };

  const register = async (username, email, password) => {
    try {
      await axios.post(`${API_BASE}/api/users/register`, {
        username,
        email,
        password
      }, {
        headers: addTraceHeaders(),
        timeout: 10000
      });
      return { success: true };
    } catch (error) {
      console.error('Registration error:', error);
      const errorMessage = error.response?.data?.error || 
                          error.response?.data?.message || 
                          (error.code === 'ECONNREFUSED' ? 'Cannot connect to server' : 'Registration failed');
      return { 
        success: false, 
        error: errorMessage
      };
    }
  };

  const logout = async () => {
    if (token) {
      try {
        await axios.post(`${API_BASE}/api/users/logout`, {}, {
          headers: { Authorization: `Bearer ${token}` },
          timeout: 5000
        });
      } catch (error) {
        console.error('Logout error:', error);
      }
    }
    
    setToken(null);
    setUsername(null);
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    console.log('User logged out');
  };

  const value = {
    token,
    username,
    login,
    register,
    logout,
    loading
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
