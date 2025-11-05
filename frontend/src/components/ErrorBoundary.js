import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({
      error: error,
      errorInfo: errorInfo
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={styles.container}>
          <div style={styles.errorBox}>
            <h2 style={styles.title}>Something went wrong</h2>
            <p style={styles.message}>
              The application encountered an error. Please refresh the page or try again later.
            </p>
            <button 
              style={styles.button}
              onClick={() => window.location.reload()}
            >
              Refresh Page
            </button>
            <button 
              style={styles.buttonSecondary}
              onClick={() => window.location.href = '/login'}
            >
              Go to Login
            </button>
            <details style={styles.details}>
              <summary>Error Details</summary>
              <pre style={styles.errorText}>
                {this.state.error && this.state.error.toString()}
                <br />
                {this.state.errorInfo.componentStack}
              </pre>
            </details>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

const styles = {
  container: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '100vh',
    backgroundColor: '#f8f9fa',
    padding: '20px'
  },
  errorBox: {
    backgroundColor: 'white',
    padding: '40px',
    borderRadius: '8px',
    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
    maxWidth: '600px',
    textAlign: 'center'
  },
  title: {
    color: '#dc3545',
    marginBottom: '20px',
    fontSize: '24px'
  },
  message: {
    color: '#6c757d',
    marginBottom: '30px',
    fontSize: '16px',
    lineHeight: '1.5'
  },
  button: {
    backgroundColor: '#007bff',
    color: 'white',
    border: 'none',
    padding: '12px 24px',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '16px',
    marginRight: '10px',
    marginBottom: '10px'
  },
  buttonSecondary: {
    backgroundColor: '#6c757d',
    color: 'white',
    border: 'none',
    padding: '12px 24px',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '16px',
    marginBottom: '20px'
  },
  details: {
    textAlign: 'left',
    marginTop: '20px',
    padding: '10px',
    backgroundColor: '#f8f9fa',
    borderRadius: '4px'
  },
  errorText: {
    fontSize: '12px',
    color: '#dc3545',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word'
  }
};

export default ErrorBoundary;
