// Frontend metrics collection
class FrontendMetrics {
  constructor() {
    this.startTime = Date.now();
    this.pageViews = 0;
    this.apiCalls = {};
    this.errors = [];
    this.performance = [];
    this.userActions = {};
    
    this.init();
  }

  init() {
    // Track page views
    this.pageViews++;
    
    // Track performance
    if (window.performance && window.performance.timing) {
      const timing = window.performance.timing;
      const loadTime = timing.loadEventEnd - timing.navigationStart;
      this.performance.push({
        type: 'page_load',
        duration: loadTime,
        timestamp: Date.now()
      });
    }
    
    // Track errors
    window.addEventListener('error', (event) => {
      this.recordError({
        type: 'javascript_error',
        message: event.message,
        filename: event.filename,
        line: event.lineno,
        timestamp: Date.now()
      });
    });
    
    // Track unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.recordError({
        type: 'promise_rejection',
        message: event.reason?.message || 'Unhandled promise rejection',
        timestamp: Date.now()
      });
    });
  }

  recordApiCall(url, method, duration, status) {
    const key = `${method} ${url}`;
    if (!this.apiCalls[key]) {
      this.apiCalls[key] = { count: 0, totalDuration: 0, errors: 0 };
    }
    
    this.apiCalls[key].count++;
    this.apiCalls[key].totalDuration += duration;
    
    if (status >= 400) {
      this.apiCalls[key].errors++;
    }
  }

  recordUserAction(action) {
    if (!this.userActions[action]) {
      this.userActions[action] = 0;
    }
    this.userActions[action]++;
  }

  recordError(error) {
    this.errors.push(error);
    // Keep only last 50 errors
    if (this.errors.length > 50) {
      this.errors = this.errors.slice(-50);
    }
  }

  getMetrics() {
    const uptime = Date.now() - this.startTime;
    const totalApiCalls = Object.values(this.apiCalls).reduce((sum, api) => sum + api.count, 0);
    const totalApiErrors = Object.values(this.apiCalls).reduce((sum, api) => sum + api.errors, 0);
    
    return {
      service: 'frontend',
      type: 'browser_metrics',
      uptimeMs: uptime,
      pageViews: this.pageViews,
      totalApiCalls,
      totalApiErrors,
      errorRate: totalApiCalls > 0 ? Math.round(totalApiErrors / totalApiCalls * 100 * 100) / 100 : 0,
      apiCalls: Object.entries(this.apiCalls).map(([endpoint, stats]) => ({
        endpoint,
        count: stats.count,
        avgDuration: Math.round(stats.totalDuration / stats.count),
        errors: stats.errors,
        errorRate: Math.round(stats.errors / stats.count * 100 * 100) / 100
      })),
      userActions: this.userActions,
      errors: this.errors.slice(-10), // Last 10 errors
      performance: {
        memoryUsage: window.performance?.memory ? {
          used: Math.round(window.performance.memory.usedJSHeapSize / 1024 / 1024 * 100) / 100,
          total: Math.round(window.performance.memory.totalJSHeapSize / 1024 / 1024 * 100) / 100,
          limit: Math.round(window.performance.memory.jsHeapSizeLimit / 1024 / 1024 * 100) / 100
        } : null,
        connection: navigator.connection ? {
          effectiveType: navigator.connection.effectiveType,
          downlink: navigator.connection.downlink,
          rtt: navigator.connection.rtt
        } : null
      },
      browser: {
        userAgent: navigator.userAgent,
        language: navigator.language,
        platform: navigator.platform,
        cookieEnabled: navigator.cookieEnabled,
        onLine: navigator.onLine
      },
      timestamp: new Date().toISOString()
    };
  }

  // Send metrics to backend (optional)
  async sendMetrics() {
    try {
      const metrics = this.getMetrics();
      // You could send this to a metrics endpoint
      console.log('Frontend Metrics:', metrics);
      return metrics;
    } catch (error) {
      console.error('Failed to send metrics:', error);
    }
  }
}

// Create global metrics instance
const frontendMetrics = new FrontendMetrics();

// Enhanced fetch wrapper to track API calls
const originalFetch = window.fetch;
window.fetch = async function(...args) {
  const start = Date.now();
  const url = args[0];
  const options = args[1] || {};
  const method = options.method || 'GET';
  
  try {
    const response = await originalFetch.apply(this, args);
    const duration = Date.now() - start;
    
    frontendMetrics.recordApiCall(url, method, duration, response.status);
    
    return response;
  } catch (error) {
    const duration = Date.now() - start;
    frontendMetrics.recordApiCall(url, method, duration, 0);
    frontendMetrics.recordError({
      type: 'api_error',
      message: error.message,
      url,
      method,
      timestamp: Date.now()
    });
    throw error;
  }
};

// Initialize browser metrics
export const initBrowserMetrics = () => {
  // Initialize the metrics instance
  return frontendMetrics;
};

export default frontendMetrics;
