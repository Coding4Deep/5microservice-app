import React, { useState, useEffect } from 'react';
import getConfig from '../config';
import frontendMetrics from '../metrics';

const MonitoringDashboard = () => {
  const [serviceStatus, setServiceStatus] = useState({});
  const [frontendMetricsData, setFrontendMetricsData] = useState(null);
  const [loading, setLoading] = useState(true);
  const config = getConfig();

  const services = [
    {
      name: 'User Service',
      port: 8080,
      database: 'PostgreSQL',
      healthUrl: `${config.USER_SERVICE_URL}/health`,
      metricsUrl: `${config.USER_SERVICE_URL}/metrics`
    },
    {
      name: 'Chat Service', 
      port: 3001,
      database: 'MongoDB, Redis, Kafka',
      healthUrl: `${config.CHAT_SERVICE_URL}/health`,
      metricsUrl: `${config.CHAT_SERVICE_URL}/metrics`
    },
    {
      name: 'Profile Service',
      port: 8081, 
      database: 'PostgreSQL, Redis',
      healthUrl: `${config.PROFILE_SERVICE_URL}/health`,
      metricsUrl: `${config.PROFILE_SERVICE_URL}/metrics`
    },
    {
      name: 'Posts Service',
      port: 8083,
      database: 'PostgreSQL, MongoDB, Redis', 
      healthUrl: `${config.POSTS_SERVICE_URL}/health`,
      metricsUrl: `${config.POSTS_SERVICE_URL}/metrics`
    }
  ];

  const databases = [
    { name: 'PostgreSQL', port: 5432, services: ['User Service', 'Profile Service', 'Posts Service'] },
    { name: 'MongoDB', port: 27017, services: ['Chat Service', 'Posts Service'] },
    { name: 'Redis', port: 6379, services: ['Chat Service', 'Profile Service', 'Posts Service'] },
    { name: 'Kafka', port: 9092, services: ['Chat Service'] }
  ];

  useEffect(() => {
    checkServicesHealth();
    updateFrontendMetrics();
    const interval = setInterval(() => {
      checkServicesHealth();
      updateFrontendMetrics();
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const updateFrontendMetrics = () => {
    const metrics = frontendMetrics.getMetrics();
    setFrontendMetricsData(metrics);
  };

  const checkServicesHealth = async () => {
    const status = {};
    
    for (const service of services) {
      try {
        const response = await fetch(service.healthUrl, { 
          method: 'GET',
          timeout: 5000 
        });
        status[service.name] = {
          status: response.ok ? 'UP' : 'DOWN',
          responseTime: Date.now()
        };
      } catch (error) {
        status[service.name] = {
          status: 'DOWN',
          error: error.message
        };
      }
    }
    
    setServiceStatus(status);
    setLoading(false);
  };

  const getStatusColor = (status) => {
    return status === 'UP' ? '#28a745' : '#dc3545';
  };

  const openUrl = (url) => {
    window.open(url, '_blank');
  };

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.loading}>Checking services...</div>
      </div>
    );
  }

  const upServices = Object.values(serviceStatus).filter(s => s.status === 'UP').length;

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1>Service Status Dashboard</h1>
        <div style={styles.headerButtons}>
          <button onClick={() => window.history.back()} style={styles.backButton}>
            ← Back
          </button>
          <button onClick={checkServicesHealth} style={styles.refreshButton}>
            🔄 Refresh
          </button>
        </div>
      </div>

      <div style={styles.overview}>
        <div style={styles.overviewCard}>
          <h3>Services Status</h3>
          <div style={styles.overviewValue}>
            {upServices}/{services.length}
          </div>
          <div style={styles.overviewLabel}>Services Running</div>
        </div>
      </div>

      <div style={styles.section}>
        <h2>Microservices</h2>
        <div style={styles.grid}>
          {services.map((service) => (
            <div key={service.name} style={styles.card}>
              <div style={styles.cardHeader}>
                <h3>{service.name}</h3>
                <span 
                  style={{
                    ...styles.statusBadge,
                    backgroundColor: getStatusColor(serviceStatus[service.name]?.status)
                  }}
                >
                  {serviceStatus[service.name]?.status || 'UNKNOWN'}
                </span>
              </div>
              <div style={styles.cardContent}>
                <p><strong>Port:</strong> {service.port}</p>
                <p><strong>Database:</strong> {service.database}</p>
                <div style={styles.buttonGroup}>
                  <button 
                    onClick={() => openUrl(service.healthUrl)}
                    style={styles.linkButton}
                  >
                    Health Check
                  </button>
                  <button 
                    onClick={() => openUrl(service.metricsUrl)}
                    style={styles.linkButton}
                  >
                    Metrics
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={styles.section}>
        <h2>Frontend Metrics</h2>
        {frontendMetricsData && (
          <div style={styles.card}>
            <div style={styles.cardHeader}>
              <h3>Browser Performance</h3>
              <span style={{...styles.statusBadge, backgroundColor: '#007bff'}}>
                ACTIVE
              </span>
            </div>
            <div style={styles.cardContent}>
              <p><strong>Uptime:</strong> {Math.round(frontendMetricsData.uptimeMs / 1000 / 60)} minutes</p>
              <p><strong>Page Views:</strong> {frontendMetricsData.pageViews}</p>
              <p><strong>API Calls:</strong> {frontendMetricsData.totalApiCalls}</p>
              <p><strong>API Errors:</strong> {frontendMetricsData.totalApiErrors} ({frontendMetricsData.errorRate}%)</p>
              <p><strong>JS Errors:</strong> {frontendMetricsData.errors.length}</p>
              {frontendMetricsData.performance.memoryUsage && (
                <p><strong>Memory:</strong> {frontendMetricsData.performance.memoryUsage.used}MB used</p>
              )}
              <div style={styles.buttonGroup}>
                <button 
                  onClick={() => console.log('Frontend Metrics:', frontendMetricsData)}
                  style={styles.linkButton}
                >
                  View Details
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <div style={styles.section}>
        <h2>Database Infrastructure</h2>
        <div style={styles.grid}>
          {databases.map((db) => (
            <div key={db.name} style={styles.card}>
              <div style={styles.cardHeader}>
                <h3>{db.name}</h3>
                <span style={{...styles.statusBadge, backgroundColor: '#007bff'}}>
                  Port {db.port}
                </span>
              </div>
              <div style={styles.cardContent}>
                <p><strong>Used by:</strong></p>
                <ul style={styles.servicesList}>
                  {db.services.map((service, idx) => (
                    <li key={idx}>{service}</li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const styles = {
  container: {
    padding: '20px',
    maxWidth: '1200px',
    margin: '0 auto',
    fontFamily: 'Arial, sans-serif'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '30px'
  },
  headerButtons: {
    display: 'flex',
    gap: '10px'
  },
  backButton: {
    padding: '10px 20px',
    backgroundColor: '#6c757d',
    color: 'white',
    border: 'none',
    borderRadius: '5px',
    cursor: 'pointer'
  },
  refreshButton: {
    padding: '10px 20px',
    backgroundColor: '#007bff',
    color: 'white',
    border: 'none',
    borderRadius: '5px',
    cursor: 'pointer'
  },
  loading: {
    textAlign: 'center',
    fontSize: '18px',
    padding: '50px'
  },
  overview: {
    display: 'flex',
    justifyContent: 'center',
    marginBottom: '30px'
  },
  overviewCard: {
    backgroundColor: 'white',
    padding: '20px',
    borderRadius: '8px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
    textAlign: 'center',
    minWidth: '200px'
  },
  overviewValue: {
    fontSize: '2em',
    fontWeight: 'bold',
    color: '#007bff',
    margin: '10px 0'
  },
  overviewLabel: {
    color: '#666',
    fontSize: '14px'
  },
  section: {
    marginBottom: '40px'
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
    gap: '20px'
  },
  card: {
    backgroundColor: 'white',
    padding: '20px',
    borderRadius: '8px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '15px'
  },
  statusBadge: {
    color: 'white',
    padding: '4px 12px',
    borderRadius: '20px',
    fontSize: '12px',
    fontWeight: 'bold'
  },
  cardContent: {
    fontSize: '14px',
    color: '#666'
  },
  buttonGroup: {
    display: 'flex',
    gap: '10px',
    marginTop: '15px'
  },
  linkButton: {
    padding: '8px 16px',
    backgroundColor: '#28a745',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '12px'
  },
  servicesList: {
    margin: '5px 0',
    paddingLeft: '20px'
  }
};

export default MonitoringDashboard;
