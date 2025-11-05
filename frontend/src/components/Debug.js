import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import getConfig from '../config';

const Debug = () => {
  const [debugInfo, setDebugInfo] = useState({});
  const [apiTests, setApiTests] = useState({});
  const { token, username } = useAuth();

  useEffect(() => {
    const config = getConfig();
    setDebugInfo({
      config,
      token: token ? 'Present' : 'Missing',
      username: username || 'Not set',
      localStorage: {
        token: localStorage.getItem('token') ? 'Present' : 'Missing',
        username: localStorage.getItem('username') || 'Not set'
      },
      windowConfig: window.APP_CONFIG || 'Not set'
    });

    testApis(config);
  }, [token, username]);

  const testApis = async (config) => {
    const tests = {};
    
    // Test each service
    const services = [
      { name: 'User Service', url: config.USER_SERVICE_URL + '/health' },
      { name: 'Chat Service', url: config.CHAT_SERVICE_URL + '/health' },
      { name: 'Profile Service', url: config.PROFILE_SERVICE_URL + '/health' },
      { name: 'Posts Service', url: config.POSTS_SERVICE_URL + '/health' }
    ];

    for (const service of services) {
      try {
        const response = await fetch(service.url);
        tests[service.name] = {
          status: response.status,
          ok: response.ok,
          data: await response.text()
        };
      } catch (error) {
        tests[service.name] = {
          status: 'Error',
          ok: false,
          error: error.message
        };
      }
    }

    setApiTests(tests);
  };

  return (
    <div style={styles.container}>
      <h1>Frontend Debug Information</h1>
      
      <div style={styles.section}>
        <h2>Configuration</h2>
        <pre style={styles.pre}>{JSON.stringify(debugInfo.config, null, 2)}</pre>
      </div>

      <div style={styles.section}>
        <h2>Authentication State</h2>
        <ul>
          <li>Token: {debugInfo.token}</li>
          <li>Username: {debugInfo.username}</li>
          <li>LocalStorage Token: {debugInfo.localStorage?.token}</li>
          <li>LocalStorage Username: {debugInfo.localStorage?.username}</li>
        </ul>
      </div>

      <div style={styles.section}>
        <h2>Window Configuration</h2>
        <pre style={styles.pre}>{JSON.stringify(debugInfo.windowConfig, null, 2)}</pre>
      </div>

      <div style={styles.section}>
        <h2>API Health Tests</h2>
        {Object.entries(apiTests).map(([service, result]) => (
          <div key={service} style={styles.apiTest}>
            <h3>{service}</h3>
            <ul>
              <li>Status: {result.status}</li>
              <li>OK: {result.ok ? 'Yes' : 'No'}</li>
              {result.data && <li>Response: {result.data}</li>}
              {result.error && <li style={{color: 'red'}}>Error: {result.error}</li>}
            </ul>
          </div>
        ))}
      </div>

      <div style={styles.section}>
        <h2>Browser Information</h2>
        <ul>
          <li>User Agent: {navigator.userAgent}</li>
          <li>URL: {window.location.href}</li>
          <li>Protocol: {window.location.protocol}</li>
          <li>Host: {window.location.host}</li>
        </ul>
      </div>
    </div>
  );
};

const styles = {
  container: {
    padding: '20px',
    maxWidth: '1200px',
    margin: '0 auto',
    fontFamily: 'monospace'
  },
  section: {
    marginBottom: '30px',
    padding: '20px',
    border: '1px solid #ddd',
    borderRadius: '8px',
    backgroundColor: '#f9f9f9'
  },
  pre: {
    backgroundColor: '#f0f0f0',
    padding: '10px',
    borderRadius: '4px',
    overflow: 'auto',
    fontSize: '12px'
  },
  apiTest: {
    marginBottom: '15px',
    padding: '10px',
    border: '1px solid #ccc',
    borderRadius: '4px',
    backgroundColor: 'white'
  }
};

export default Debug;
