import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { traceUserAction } from '../utils/tracing';

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, token } = useAuth();
  const navigate = useNavigate();

  // Redirect if already logged in
  useEffect(() => {
    if (token) {
      console.log('User already logged in, redirecting to dashboard');
      navigate('/dashboard', { replace: true });
    }
  }, [token, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!username.trim() || !password.trim()) {
      setError('Please enter both username and password');
      return;
    }

    const span = traceUserAction('login', {
      'user.username': username
    });
    
    setLoading(true);
    setError('');

    try {
      console.log('Attempting login for user:', username);
      const result = await login(username.trim(), password);
      
      if (result.success) {
        console.log('Login successful, redirecting to dashboard');
        span.addEvent('login.success');
        span.setAttributes({ 'user.id': result.userId });
        navigate('/dashboard', { replace: true });
      } else {
        console.error('Login failed:', result.error);
        span.addEvent('login.failed');
        span.recordException(new Error(result.error));
        setError(result.error);
      }
    } catch (error) {
      console.error('Login error:', error);
      span.recordException(error);
      setError('Login failed. Please try again.');
    } finally {
      span.end();
      setLoading(false);
    }
  };

  // Don't render login form if already authenticated
  if (token) {
    return (
      <div style={styles.container}>
        <div style={styles.form}>
          <div style={styles.loading}>Redirecting to dashboard...</div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.form}>
        <h2 style={styles.title}>Login to Chat</h2>
        {error && <div style={styles.error}>{error}</div>}
        <form onSubmit={handleSubmit}>
          <input
            type="text"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            style={styles.input}
            required
            disabled={loading}
            autoComplete="username"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={styles.input}
            required
            disabled={loading}
            autoComplete="current-password"
          />
          <button 
            type="submit" 
            disabled={loading || !username.trim() || !password.trim()} 
            style={{
              ...styles.button,
              opacity: (loading || !username.trim() || !password.trim()) ? 0.6 : 1,
              cursor: (loading || !username.trim() || !password.trim()) ? 'not-allowed' : 'pointer'
            }}
          >
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>
        <p style={styles.link}>
          Don't have an account? <Link to="/register">Register here</Link>
        </p>
        <div style={styles.testInfo}>
          <small style={styles.testText}>
            Test credentials: alice/pass1234 or bob/pass1234
          </small>
        </div>
      </div>
    </div>
  );
};

const styles = {
  container: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '100vh',
    backgroundColor: '#f5f5f5'
  },
  form: {
    backgroundColor: 'white',
    padding: '2rem',
    borderRadius: '8px',
    boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
    width: '100%',
    maxWidth: '400px'
  },
  title: {
    textAlign: 'center',
    marginBottom: '1.5rem',
    color: '#333'
  },
  input: {
    width: '100%',
    padding: '0.75rem',
    marginBottom: '1rem',
    border: '1px solid #ddd',
    borderRadius: '4px',
    fontSize: '1rem',
    boxSizing: 'border-box'
  },
  button: {
    width: '100%',
    padding: '0.75rem',
    backgroundColor: '#007bff',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    fontSize: '1rem',
    fontWeight: 'bold'
  },
  error: {
    backgroundColor: '#f8d7da',
    color: '#721c24',
    padding: '0.75rem',
    borderRadius: '4px',
    marginBottom: '1rem',
    border: '1px solid #f5c6cb'
  },
  link: {
    textAlign: 'center',
    marginTop: '1rem'
  },
  loading: {
    textAlign: 'center',
    padding: '2rem',
    fontSize: '16px',
    color: '#6c757d'
  },
  testInfo: {
    marginTop: '1rem',
    padding: '0.5rem',
    backgroundColor: '#f8f9fa',
    borderRadius: '4px',
    textAlign: 'center'
  },
  testText: {
    color: '#6c757d',
    fontSize: '12px'
  }
};

export default Login;
