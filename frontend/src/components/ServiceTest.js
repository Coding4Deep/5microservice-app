import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import getConfig from '../config';

const ServiceTest = () => {
  const [results, setResults] = useState({});
  const { token } = useAuth();
  const config = getConfig();

  useEffect(() => {
    testServices();
  }, []);

  const testServices = async () => {
    const services = [
      { name: 'User Service', url: `${config.USER_SERVICE_URL}/health` },
      { name: 'Chat Service', url: `${config.CHAT_SERVICE_URL}/health` },
      { name: 'Profile Service', url: `${config.PROFILE_SERVICE_URL}/health` },
      { name: 'Posts Service', url: `${config.POSTS_SERVICE_URL}/health` }
    ];

    const testResults = {};

    for (const service of services) {
      try {
        const response = await fetch(service.url, {
          headers: token ? { 'Authorization': `Bearer ${token}` } : {}
        });
        testResults[service.name] = {
          status: response.ok ? 'OK' : 'ERROR',
          code: response.status,
          url: service.url
        };
      } catch (error) {
        testResults[service.name] = {
          status: 'FAILED',
          error: error.message,
          url: service.url
        };
      }
    }

    setResults(testResults);
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'monospace' }}>
      <h2>Service Connectivity Test</h2>
      <button onClick={testServices} style={{ margin: '10px 0', padding: '10px' }}>
        Retest Services
      </button>
      
      <div>
        <h3>Configuration:</h3>
        <pre>{JSON.stringify(config, null, 2)}</pre>
      </div>

      <div>
        <h3>Test Results:</h3>
        {Object.entries(results).map(([name, result]) => (
          <div key={name} style={{ 
            margin: '10px 0', 
            padding: '10px', 
            border: '1px solid #ccc',
            backgroundColor: result.status === 'OK' ? '#d4edda' : '#f8d7da'
          }}>
            <strong>{name}</strong>: {result.status}
            <br />
            URL: {result.url}
            <br />
            {result.code && `Status Code: ${result.code}`}
            {result.error && `Error: ${result.error}`}
          </div>
        ))}
      </div>
    </div>
  );
};

export default ServiceTest;
