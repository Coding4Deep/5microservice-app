import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import getConfig from '../config';
import io from 'socket.io-client';

const ServiceStatus = ({ name, url, description }) => {
  const [status, setStatus] = React.useState('checking');
  
  React.useEffect(() => {
    const checkHealth = async () => {
      try {
        const response = await fetch(url, { 
          method: 'GET',
          timeout: 3000 
        });
        setStatus(response.ok ? 'up' : 'down');
      } catch (error) {
        setStatus('down');
      }
    };
    
    checkHealth();
    const interval = setInterval(checkHealth, 30000);
    return () => clearInterval(interval);
  }, [url]);
  
  const statusColor = status === 'up' ? '#28a745' : status === 'down' ? '#dc3545' : '#ffc107';
  const statusText = status === 'up' ? '🟢 UP' : status === 'down' ? '🔴 DOWN' : '🟡 CHECKING';
  
  return (
    <div style={styles.serviceCard}>
      <div style={styles.serviceName}>{name}</div>
      <div style={styles.serviceDescription}>{description}</div>
      <div style={{...styles.serviceStatus, color: statusColor}}>
        {statusText}
      </div>
    </div>
  );
};

const Dashboard = () => {
  const [dashboardData, setDashboardData] = useState(null);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [socket, setSocket] = useState(null);
  const { username, token, logout } = useAuth();
  const navigate = useNavigate();

  const config = getConfig();
  const USER_SERVICE_URL = config.USER_SERVICE_URL;
  const CHAT_SERVICE_URL = config.CHAT_SERVICE_URL;
  const PROFILE_SERVICE_URL = config.PROFILE_SERVICE_URL;

  useEffect(() => {
    if (!username || !token) {
      console.log('No username or token, redirecting to login');
      navigate('/login', { replace: true });
      return;
    }

    let newSocket = null;
    
    // Try to connect to chat service, but don't block dashboard if it fails
    try {
      newSocket = io(CHAT_SERVICE_URL, {
        timeout: 2000,
        forceNew: true
      });
      setSocket(newSocket);

      newSocket.on('connect', () => {
        console.log('Socket connected');
        newSocket.emit('join', username);
      });

      newSocket.on('connect_error', (error) => {
        console.log('Chat service unavailable - socket connection failed');
      });

      newSocket.on('activeUsers', (users) => {
        setOnlineUsers((users || []).filter(u => u !== username));
      });
    } catch (error) {
      console.log('Chat service unavailable - cannot initialize socket');
    }

    // Fetch data immediately
    const fetchAllData = async () => {
      setLoading(false);
      
      // Try to fetch data from available services, but don't block dashboard
      fetchDashboardData().catch(err => console.log('User service unavailable:', err));
      fetchOnlineUsers().catch(err => console.log('Chat service unavailable:', err));
      fetchUserProfile().catch(err => console.log('Profile service unavailable:', err));
    };

    fetchAllData();
    
    const interval = setInterval(() => {
      fetchOnlineUsers().catch(() => {}); // Silent fail for periodic updates
    }, 10000);
    
    return () => {
      clearInterval(interval);
      if (newSocket) {
        newSocket.disconnect();
      }
    };
  }, [username, token, navigate, CHAT_SERVICE_URL]); // Fixed dependencies


  const fetchUserProfile = async () => {
    try {
      const response = await fetch(`${PROFILE_SERVICE_URL}/api/profile/${username}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      if (response.ok) {
        const data = await response.json();
        setUserProfile(data);
      }
    } catch (err) {
      console.error('Cannot fetch user profile:', err);
    }
  };

  const fetchDashboardData = async () => {
    try {
      const response = await fetch(`${USER_SERVICE_URL}/api/users/dashboard`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setDashboardData(data);
      } else if (response.status === 401) {
        console.log('Unauthorized, logging out');
        logout();
        navigate('/login', { replace: true });
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (err) {
      console.log('User service unavailable:', err.message);
      // Set default data when service is unavailable
      setDashboardData({
        totalUsers: 0,
        activeUsers: 0,
        users: []
      });
    }
  };

  const fetchOnlineUsers = async () => {
    try {
      const response = await fetch(`${CHAT_SERVICE_URL}/api/users/active`);
      if (response.ok) {
        const data = await response.json();
        setOnlineUsers((data.activeUsers || []).filter(u => u !== username));
      }
    } catch (err) {
      console.error('Cannot fetch online users:', err);
    }
  };

  const startPrivateChat = (targetUser) => {
    navigate('/chat', { 
      state: { 
        selectedUser: targetUser, 
        chatMode: 'private' 
      } 
    });
  };

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login', { replace: true });
    } catch (error) {
      console.error('Logout error:', error);
      navigate('/login', { replace: true });
    }
  };

  if (!username || !token) {
    return (
      <div style={styles.container}>
        <div style={styles.loading}>Redirecting to login...</div>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.loading}>Loading dashboard...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.container}>
        <div style={styles.error}>
          <h3>Error: {error}</h3>
          <p>There was a problem loading your dashboard. Please check your connection and backend services.</p>
          <div style={styles.errorActions}>
            <button onClick={() => window.location.reload()} style={styles.primaryButton}>
              Retry
            </button>
            <button onClick={() => navigate('/login')} style={styles.dangerButton}>
              Go to Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={styles.userSection}>
          <div style={styles.profilePicture}>
            {userProfile?.profile_picture ? (
              <img 
                src={`${PROFILE_SERVICE_URL}${userProfile.profile_picture}`} 
                alt="Profile" 
                style={styles.profileImg}
                onError={(e) => {
                  e.target.style.display = 'none';
                }}
              />
            ) : (
              <div style={styles.defaultAvatar}>
                <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
                  <circle cx="20" cy="20" r="20" fill="#e9ecef"/>
                  <circle cx="20" cy="16" r="6" fill="#6c757d"/>
                  <path d="M8 32c0-6.627 5.373-12 12-12s12 5.373 12 12" fill="#6c757d"/>
                </svg>
              </div>
            )}
          </div>
          <div>
            <h1>Dashboard</h1>
            <p>Welcome, {username}!</p>
          </div>
        </div>
        <div>
          <button onClick={() => navigate('/profile')} style={styles.primaryButton}>
            My Profile
          </button>
          <button onClick={() => navigate('/my-posts')} style={styles.primaryButton}>
            📝 My Posts
          </button>
          <button onClick={() => navigate('/posts')} style={styles.primaryButton}>
            📸 All Posts
          </button>
          <button onClick={() => navigate('/chat')} style={styles.primaryButton}>
            Go to Chat
          </button>
          <button onClick={() => navigate('/services')} style={styles.monitoringButton}>
            🔧 Services Status
          </button>
          <button onClick={() => navigate('/test')} style={styles.monitoringButton}>
            🧪 Service Test
          </button>
          <button onClick={handleLogout} style={styles.dangerButton}>
            Logout
          </button>
        </div>
      </div>

      <div style={styles.content}>
        <div style={styles.section}>
          <h2>🔧 Service Status</h2>
          <div style={styles.serviceGrid}>
            <ServiceStatus 
              name="User Service" 
              url={`${USER_SERVICE_URL}/health`}
              description="Authentication & User Management"
            />
            <ServiceStatus 
              name="Chat Service" 
              url={`${CHAT_SERVICE_URL}/health`}
              description="Real-time Messaging"
            />
            <ServiceStatus 
              name="Profile Service" 
              url={`${PROFILE_SERVICE_URL}/health`}
              description="User Profiles & Images"
            />
            <ServiceStatus 
              name="Posts Service" 
              url={config.POSTS_SERVICE_URL + '/health'}
              description="Image Posts & Sharing"
            />
          </div>
        </div>

        <div style={styles.statsGrid}>
          <div style={styles.statCard}>
            <h3>Total Users</h3>
            <div style={styles.statNumber}>{dashboardData?.totalUsers || 0}</div>
          </div>
          <div style={styles.statCard}>
            <h3>Registered & Active</h3>
            <div style={styles.statNumber}>{dashboardData?.activeUsers || 0}</div>
          </div>
          <div style={styles.statCard}>
            <h3>Currently Online</h3>
            <div style={styles.statNumber}>{onlineUsers.length}</div>
            <button onClick={fetchOnlineUsers} style={styles.refreshButton}>
              🔄 Refresh
            </button>
          </div>
        </div>

        {onlineUsers.length > 0 && (
          <div style={styles.section}>
            <h2>🟢 Users Online Now (In Chat)</h2>
            <div style={styles.onlineGrid}>
              {onlineUsers.map(user => (
                <div key={user} style={styles.onlineCard}>
                  <div>
                    <div style={styles.onlineUser}>👤 {user}</div>
                    <div style={styles.onlineStatus}>🟢 Online in chat</div>
                  </div>
                  <button
                    onClick={() => startPrivateChat(user)}
                    style={styles.chatButton}
                  >
                    💬 Chat Now
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={styles.section}>
          <h2>All Registered Users</h2>
          <div style={styles.usersList}>
            {dashboardData?.users?.map(user => (
              <div key={user.id} style={styles.userCard}>
                <div style={styles.userInfo}>
                  <div style={styles.userName}>
                    {user.username}
                    {user.username === username && <span style={styles.youBadge}> (You)</span>}
                  </div>
                  <div style={styles.userEmail}>{user.email}</div>
                  <div style={styles.lastSeen}>
                    Last seen: {new Date(user.lastSeen).toLocaleString()}
                  </div>
                </div>
                <div style={styles.userActions}>
                  <div style={styles.statusContainer}>
                    <div style={{
                      ...styles.statusBadge,
                      backgroundColor: user.active ? '#28a745' : '#6c757d'
                    }}>
                      {user.active ? '✓ Active Account' : '✗ Inactive Account'}
                    </div>
                    <div style={{
                      ...styles.statusBadge,
                      backgroundColor: onlineUsers.includes(user.username) ? '#007bff' : '#e9ecef',
                      color: onlineUsers.includes(user.username) ? 'white' : '#6c757d'
                    }}>
                      {onlineUsers.includes(user.username) ? '🟢 Online' : '⚫ Offline'}
                    </div>
                  </div>
                  {user.username !== username && (
                    <>
                      <button
                        onClick={() => navigate(`/profile/${user.username}`)}
                        style={styles.profileButton}
                      >
                        👤 View Profile
                      </button>
                      <button
                        onClick={() => startPrivateChat(user.username)}
                        style={{
                          ...styles.chatButton,
                          backgroundColor: onlineUsers.includes(user.username) ? '#28a745' : '#ffc107',
                          color: onlineUsers.includes(user.username) ? 'white' : 'black'
                        }}
                      >
                        💬 {onlineUsers.includes(user.username) ? 'Chat Now' : 'Send Message'}
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {onlineUsers.length === 0 && (
          <div style={styles.section}>
            <div style={styles.emptyState}>
              <h3>No Other Users Online</h3>
              <p>When other users join the chat, they will appear here and you can start private conversations.</p>
              <button onClick={fetchOnlineUsers} style={styles.primaryButton}>
                🔄 Check Again
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const styles = {
  container: {
    minHeight: '100vh',
    backgroundColor: '#f8f9fa',
    padding: '20px'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '30px',
    padding: '20px',
    backgroundColor: 'white',
    borderRadius: '8px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
  },
  userSection: {
    display: 'flex',
    alignItems: 'center',
    gap: '15px'
  },
  profilePicture: {
    width: '50px',
    height: '50px',
    borderRadius: '50%',
    overflow: 'hidden',
    border: '2px solid #007bff',
    position: 'relative'
  },
  profileImg: {
    width: '100%',
    height: '100%',
    objectFit: 'cover'
  },
  defaultAvatar: {
    width: '100%',
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8f9fa'
  },
  content: {
    maxWidth: '1200px',
    margin: '0 auto'
  },
  serviceGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
    gap: '15px',
    marginBottom: '20px'
  },
  serviceCard: {
    padding: '15px',
    border: '1px solid #dee2e6',
    borderRadius: '6px',
    backgroundColor: '#f8f9fa',
    textAlign: 'center'
  },
  serviceName: {
    fontSize: '16px',
    fontWeight: 'bold',
    marginBottom: '5px'
  },
  serviceDescription: {
    fontSize: '12px',
    color: '#6c757d',
    marginBottom: '10px'
  },
  serviceStatus: {
    fontSize: '14px',
    fontWeight: 'bold'
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
    gap: '20px',
    marginBottom: '30px'
  },
  statCard: {
    backgroundColor: 'white',
    padding: '20px',
    borderRadius: '8px',
    textAlign: 'center',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
  },
  statNumber: {
    fontSize: '2.5rem',
    fontWeight: 'bold',
    color: '#007bff',
    margin: '10px 0'
  },
  section: {
    backgroundColor: 'white',
    padding: '20px',
    borderRadius: '8px',
    marginBottom: '20px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
  },
  onlineGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
    gap: '15px'
  },
  onlineCard: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '15px',
    border: '2px solid #007bff',
    borderRadius: '8px',
    backgroundColor: '#f0f8ff'
  },
  onlineUser: {
    fontSize: '18px',
    fontWeight: 'bold',
    color: '#007bff'
  },
  onlineStatus: {
    fontSize: '14px',
    color: '#28a745'
  },
  usersList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px'
  },
  userCard: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '15px',
    border: '1px solid #dee2e6',
    borderRadius: '6px',
    backgroundColor: '#f8f9fa'
  },
  userInfo: {
    flex: 1
  },
  userName: {
    fontSize: '18px',
    fontWeight: 'bold',
    marginBottom: '5px'
  },
  youBadge: {
    color: '#007bff',
    fontSize: '14px'
  },
  userEmail: {
    color: '#6c757d',
    marginBottom: '5px'
  },
  lastSeen: {
    color: '#6c757d',
    fontSize: '12px'
  },
  userActions: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: '8px'
  },
  statusContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '5px'
  },
  statusBadge: {
    padding: '4px 8px',
    borderRadius: '12px',
    fontSize: '12px',
    fontWeight: 'bold',
    color: 'white'
  },
  primaryButton: {
    padding: '12px 20px',
    backgroundColor: '#007bff',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 'bold',
    marginRight: '10px'
  },
  dangerButton: {
    padding: '12px 20px',
    backgroundColor: '#dc3545',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 'bold'
  },
  monitoringButton: {
    padding: '12px 20px',
    backgroundColor: '#17a2b8',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 'bold',
    marginRight: '10px'
  },
  chatButton: {
    padding: '8px 12px',
    backgroundColor: '#28a745',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: 'bold',
    marginLeft: '5px'
  },
  profileButton: {
    padding: '8px 12px',
    backgroundColor: '#007bff',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: 'bold'
  },
  refreshButton: {
    padding: '5px 10px',
    backgroundColor: '#6c757d',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '12px',
    marginTop: '10px'
  },
  emptyState: {
    textAlign: 'center',
    padding: '40px',
    color: '#6c757d'
  },
  loading: {
    textAlign: 'center',
    padding: '50px',
    fontSize: '18px'
  },
  error: {
    textAlign: 'center',
    padding: '50px',
    color: '#dc3545'
  },
  errorActions: {
    marginTop: '20px',
    display: 'flex',
    justifyContent: 'center',
    gap: '10px'
  }
};

export default Dashboard;
