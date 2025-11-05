// Stub tracing utilities - OpenTelemetry disabled

export const traceUserAction = (actionName, attributes = {}) => {
  console.log(`[TRACE STUB] ${actionName}`, attributes);
  return {
    end: () => {},
    setStatus: () => {},
    recordException: () => {},
    spanContext: () => ({ traceId: 'stub', spanId: 'stub' })
  };
};

export const traceApiCall = (method, url, attributes = {}) => {
  console.log(`[TRACE STUB] API ${method} ${url}`, attributes);
  return {
    end: () => {},
    setStatus: () => {},
    recordException: () => {},
    spanContext: () => ({ traceId: 'stub', spanId: 'stub' })
  };
};

export const addTraceHeaders = (headers = {}) => {
  return headers;
};

export const tracer = {
  startSpan: (name, options) => ({
    end: () => {},
    setStatus: () => {},
    recordException: () => {},
    spanContext: () => ({ traceId: 'stub', spanId: 'stub' })
  })
};
