// Configuration utility for runtime environment variables
const getConfig = () => {
  // Try to get from window.APP_CONFIG first (for runtime config)
  if (window.APP_CONFIG) {
    return window.APP_CONFIG;
  }
  
  // Fallback to process.env (for build-time config)
  return {
    USER_SERVICE_URL: process.env.REACT_APP_USER_SERVICE_URL || 'http://localhost:8080',
    CHAT_SERVICE_URL: process.env.REACT_APP_CHAT_SERVICE_URL || 'http://localhost:3001', 
    POSTS_SERVICE_URL: process.env.REACT_APP_POSTS_SERVICE_URL || 'http://localhost:8083',
    PROFILE_SERVICE_URL: process.env.REACT_APP_PROFILE_SERVICE_URL || 'http://localhost:8081'
  };
};

export default getConfig;
