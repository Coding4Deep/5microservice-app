package com.chat.userservice.config;

import jakarta.servlet.*;
import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.MDC;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.util.UUID;

@Component
public class LoggingFilter implements Filter {

    @Override
    public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain)
            throws IOException, ServletException {

        HttpServletRequest httpRequest = (HttpServletRequest) request;

        // Generate or extract correlation IDs
        String requestId = httpRequest.getHeader("X-Request-ID");
        if (requestId == null) {
            requestId = UUID.randomUUID().toString();
        }

        String traceId = httpRequest.getHeader("X-Trace-ID");
        if (traceId == null) {
            traceId = UUID.randomUUID().toString();
        }

        // Set MDC for structured logging
        MDC.put("requestId", requestId);
        MDC.put("traceId", traceId);
        MDC.put("method", httpRequest.getMethod());
        MDC.put("path", httpRequest.getRequestURI());
        MDC.put("userAgent", httpRequest.getHeader("User-Agent"));

        try {
            chain.doFilter(request, response);
        } finally {
            MDC.clear();
        }
    }
}
