require('./tracing'); // Initialize tracing first
try { require('dotenv').config(); } catch (_) {}
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const mongoose = require('mongoose');
const redis = require('redis');
const { Kafka } = require('kafkajs');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const helmet = require('helmet');
const promClient = require('prom-client');
const winston = require('winston');
const expressWinston = require('express-winston');
const { v4: uuidv4 } = require('uuid');
const { trace } = require('@opentelemetry/api');

const SERVICE_NAME = process.env.SERVICE_NAME || 'chat-service';
const tracer = trace.getTracer('chat-service');

// Configure structured logging
const logger = winston.createLogger({
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json(),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
      return JSON.stringify({
        timestamp,
        level,
        service: SERVICE_NAME,
        instance: process.env.HOSTNAME || require('os').hostname(),
        version: process.env.SERVICE_VERSION || '1.0.0',
        environment: process.env.ENVIRONMENT || 'development',
        message,
        ...meta
      });
    })
  ),
  transports: [
    new winston.transports.Console()
  ]
});

// Initialize Prometheus metrics
const register = new promClient.Registry();
promClient.collectDefaultMetrics({ register });

// Deployment metadata
const deploymentLabels = {
  service: SERVICE_NAME,
  version: process.env.SERVICE_VERSION || '1.0.0',
  commit_sha: process.env.GIT_COMMIT_SHA || 'unknown',
  instance_id: process.env.INSTANCE_ID || require('os').hostname(),
  environment: process.env.ENVIRONMENT || 'development'
};

// Custom Prometheus metrics
const httpRequestsTotal = new promClient.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code', 'service', 'version', 'commit_sha', 'instance_id', 'environment'],
  registers: [register]
});

const httpRequestDuration = new promClient.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'service', 'version', 'commit_sha', 'instance_id', 'environment'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 5],
  registers: [register]
});

const serviceErrorsTotal = new promClient.Counter({
  name: 'service_errors_total',
  help: 'Total number of service errors',
  labelNames: ['error_type', 'service', 'version', 'commit_sha', 'instance_id', 'environment'],
  registers: [register]
});

const chatMessagesTotal = new promClient.Counter({
  name: 'business_chat_messages_total',
  help: 'Total number of chat messages sent',
  labelNames: ['message_type', 'service', 'version', 'commit_sha', 'instance_id', 'environment'],
  registers: [register]
});

const activeUsersGauge = new promClient.Gauge({
  name: 'chat_active_users',
  help: 'Number of currently active users',
  labelNames: ['service', 'version', 'commit_sha', 'instance_id', 'environment'],
  registers: [register]
});

const app = express();
const server = http.createServer(app);

// Request correlation middleware
app.use((req, res, next) => {
  req.requestId = req.headers['x-request-id'] || uuidv4();
  req.traceId = req.headers['x-trace-id'] || uuidv4();
  
  res.setHeader('X-Request-ID', req.requestId);
  res.setHeader('X-Trace-ID', req.traceId);
  
  // Add correlation to all logs in this request
  req.logger = logger.child({
    requestId: req.requestId,
    traceId: req.traceId,
    method: req.method,
    path: req.path,
    userAgent: req.headers['user-agent']
  });
  
  next();
});

// Env-configurable CORS origins for Socket.IO
const RAW_CORS_ORIGINS = process.env.CORS_ORIGINS || '*';
const corsOrigins = RAW_CORS_ORIGINS === '*' ? true : RAW_CORS_ORIGINS.split(',').map(o => o.trim());

const io = socketIo(server, {
  cors: {
    origin: corsOrigins,
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Middleware
app.use(helmet());
app.use(cors({ origin: corsOrigins, credentials: true }));
app.use(express.json());

// Metrics state (simple in-memory counters)
const metrics = {
  service: SERVICE_NAME,
  startTime: Date.now(),
  requestsTotal: 0,
  requestsByRoute: {},
  errorsTotal: 0,
  latenciesMs: [], // store last 500 latencies for simple stats
  chatMessagesTotal: 0,
};

function recordLatency(ms) {
  metrics.latenciesMs.push(ms);
  if (metrics.latenciesMs.length > 500) metrics.latenciesMs.shift();
}

function latencyStats() {
  const arr = metrics.latenciesMs.slice().sort((a,b)=>a-b);
  if (arr.length === 0) return { count: 0, min: 0, p50: 0, p95: 0, max: 0, avg: 0 };
  const sum = arr.reduce((s,v)=>s+v,0);
  const idx = (p) => arr[Math.min(arr.length-1, Math.floor(p*arr.length))];
  return {
    count: arr.length,
    min: arr[0],
    p50: idx(0.5),
    p95: idx(0.95),
    max: arr[arr.length-1],
    avg: Math.round(sum / arr.length * 100) / 100
  };
}

function recordError(errorType) {
  metrics.errorsTotal += 1;
  serviceErrorsTotal.inc({ ...deploymentLabels, error_type: errorType });
}

function recordChatMessage(messageType = 'public') {
  metrics.chatMessagesTotal += 1;
  chatMessagesTotal.inc({ ...deploymentLabels, message_type: messageType });
}

function updateActiveUsers() {
  activeUsersGauge.set(deploymentLabels, connectedUsers.size);
}

// Request logging + metrics middleware
app.use((req, res, next) => {
  const start = process.hrtime.bigint();
  const traceId = req.headers['x-request-id'] || uuidv4();
  res.setHeader('x-request-id', traceId);
  const routeKey = `${req.method} ${req.path}`;
  metrics.requestsTotal += 1;
  metrics.requestsByRoute[routeKey] = (metrics.requestsByRoute[routeKey] || 0) + 1;

  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
    const durationSeconds = durationMs / 1000;
    recordLatency(durationMs);
    
    // Prometheus metrics
    httpRequestsTotal.inc({ 
      ...deploymentLabels, 
      method: req.method, 
      route: req.path, 
      status_code: res.statusCode.toString() 
    });
    httpRequestDuration.observe({ 
      ...deploymentLabels, 
      method: req.method, 
      route: req.path 
    }, durationSeconds);
    
    const logEntry = {
      timestamp: new Date().toISOString(),
      service: SERVICE_NAME,
      level: 'info',
      traceId,
      method: req.method,
      path: req.originalUrl || req.url,
      status: res.statusCode,
      durationMs: Math.round(durationMs),
      message: 'request_completed',
      version: deploymentLabels.version,
      commit_sha: deploymentLabels.commit_sha,
      instance_id: deploymentLabels.instance_id,
      environment: deploymentLabels.environment
    };
    logger.info('Request completed', logEntry);
  });

  next();
});

// Environment variables
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/chatdb';
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const KAFKA_BROKERS = process.env.KAFKA_BROKERS || 'localhost:9092';
const USER_SERVICE_URL = process.env.USER_SERVICE_URL || 'http://localhost:8080';

// MongoDB connection
mongoose.connect(MONGODB_URI)
  .then(() => logger.info('MongoDB connected'))
  .catch(err => {
    recordError('mongodb_connection');
    logger.error('MongoDB connection error', { error: String(err) });
  });

// Message schema
const messageSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  username: { type: String, required: true },
  message: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  room: { type: String, default: 'general' },
  isPrivate: { type: Boolean, default: false },
  recipient: { type: String, default: null }
});

const Message = mongoose.model('Message', messageSchema);

// Redis client
const redisClient = redis.createClient({ url: REDIS_URL });
redisClient.connect()
  .then(() => logger.info('Redis connected'))
  .catch(err => {
    recordError('redis_connection');
    logger.error('Redis connection error', { error: String(err) });
  });

// Kafka setup
const kafka = new Kafka({
  clientId: 'chat-service',
  brokers: [KAFKA_BROKERS],
  retry: {
    initialRetryTime: 100,
    retries: 8
  }
});

let producer = null;
let consumer = null;
let kafkaConnected = false;

// Initialize Kafka with retry logic
async function initKafka() {
  try {
    producer = kafka.producer();
    consumer = kafka.consumer({ groupId: 'chat-group' });
    
    await producer.connect();
    await consumer.connect();
    await consumer.subscribe({ topic: 'chat-messages' });
    
    await consumer.run({
      eachMessage: async ({ message }) => {
        try {
          const data = JSON.parse(message.value.toString());
          logger.info('Kafka message received', { data });
          
          // Save to MongoDB using upsert to avoid duplicates
          await Message.findOneAndUpdate(
            { id: data.id },
            data,
            { upsert: true, new: true }
          );
          
          // Broadcast only public messages to all clients
          if (!data.isPrivate) {
            io.emit('message', data);
          }
        } catch (error) {
          recordError('kafka_message_processing');
          logger.error('Kafka message error', { error: String(error) });
        }
      },
    });
    
    kafkaConnected = true;
    logger.info('Kafka connected');
  } catch (error) {
    logger.warn('Kafka connect failed', { error: String(error) });
    logger.warn('Continuing without Kafka');
    kafkaConnected = false;
  }
}

// Socket.IO connection handling
const connectedUsers = new Map(); // Track connected users

io.on('connection', (socket) => {
  logger.info('Socket connected', { socketId: socket.id });
  
  socket.on('join', async (username) => {
    socket.username = username;
    connectedUsers.set(username, socket.id);
    updateActiveUsers();
    logger.info('User joined', { username });
    
    // Get public message history
    const messages = await Message.find({ isPrivate: false }).sort({ timestamp: 1 }).limit(50);
    socket.emit('messageHistory', messages);
    
    // Get private message history for this user
    const privateMessages = await Message.find({
      isPrivate: true,
      $or: [{ username: username }, { recipient: username }]
    }).sort({ timestamp: 1 });
    socket.emit('privateMessageHistory', privateMessages);
    
    // Send updated user list to all clients
    const activeUsers = Array.from(connectedUsers.keys());
    io.emit('activeUsers', activeUsers);
    
    // Notify others
    socket.broadcast.emit('userJoined', username);
  });
  
  socket.on('sendMessage', async (data) => {
    const span = tracer.startSpan('sendMessage', {
      attributes: {
        'message.type': data.isPrivate ? 'private' : 'public',
        'message.username': data.username,
        'message.recipient': data.recipient || 'public'
      }
    });
    
    try {
      const messageData = {
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        username: data.username,
        message: data.message,
        timestamp: new Date(),
        room: data.room || 'general',
        isPrivate: data.isPrivate || false,
        recipient: data.recipient || null
      };
      
      // Save to MongoDB using upsert to avoid duplicates
      await Message.findOneAndUpdate(
        { id: messageData.id },
        messageData,
        { upsert: true, new: true }
      );
      
      // If Kafka is available, send to Kafka, otherwise broadcast directly
      if (kafkaConnected && producer) {
        await producer.send({
          topic: 'chat-messages',
          messages: [{ value: JSON.stringify(messageData) }]
        });
      } else {
        // Direct broadcast if Kafka is not available
        if (!messageData.isPrivate) {
          io.emit('message', messageData);
        }
      }
      recordChatMessage('public');
      span.setAttribute('message.id', messageData.id);
    } catch (error) {
      recordError('message_send');
      logger.error('Send message error', { error: String(error) });
      span.recordException(error);
      // Fallback: broadcast directly even if save fails
      if (!messageData.isPrivate) {
        io.emit('message', messageData);
      }
    } finally {
      span.end();
    }
  });
  
  socket.on('sendPrivateMessage', async (data) => {
    const span = tracer.startSpan('sendPrivateMessage', {
      attributes: {
        'message.username': data.username,
        'message.recipient': data.recipient
      }
    });
    
    try {
      const messageData = {
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        username: data.username,
        message: data.message,
        timestamp: new Date(),
        room: 'private',
        isPrivate: true,
        recipient: data.recipient
      };
      
      // Save to MongoDB using upsert to avoid duplicates (for offline delivery)
      await Message.findOneAndUpdate(
        { id: messageData.id },
        messageData,
        { upsert: true, new: true }
      );
      
      recordChatMessage('private');
      span.setAttribute('message.id', messageData.id);
      
      // Send to sender immediately
      socket.emit('privateMessage', messageData);
      
      // Send to recipient if online, otherwise store for later delivery
      const recipientSocketId = connectedUsers.get(data.recipient);
      if (recipientSocketId) {
        io.to(recipientSocketId).emit('privateMessage', messageData);
      }
      // If recipient is offline, message is already saved and will be delivered when they connect
    } catch (error) {
      recordError('private_message_send');
      logger.error('Send private message error', { error: String(error) });
      span.recordException(error);
    } finally {
      span.end();
    }
  });

  socket.on('deleteMessage', async (messageId) => {
    try {
      const deletedMessage = await Message.findOneAndDelete({ id: messageId });
      if (deletedMessage) {
        // Broadcast deletion to all clients for public messages
        if (!deletedMessage.isPrivate) {
          io.emit('messageDeleted', messageId);
        } else {
          // For private messages, only notify the conversation participants
          socket.emit('messageDeleted', messageId);
          const otherUser = deletedMessage.username === socket.username ? 
            deletedMessage.recipient : deletedMessage.username;
          const otherSocketId = connectedUsers.get(otherUser);
          if (otherSocketId) {
            io.to(otherSocketId).emit('messageDeleted', messageId);
          }
        }
      }
    } catch (error) {
      console.error('Error deleting message:', error);
    }
  });
  
  socket.on('clearChat', async () => {
    try {
      await Message.deleteMany({});
      io.emit('chatCleared');
    } catch (error) {
      console.error('Error clearing chat:', error);
    }
  });
  
  socket.on('disconnect', () => {
    logger.info('Socket disconnected', { socketId: socket.id });
    if (socket.username) {
      connectedUsers.delete(socket.username);
      updateActiveUsers();
      const activeUsers = Array.from(connectedUsers.keys());
      io.emit('activeUsers', activeUsers);
      socket.broadcast.emit('userLeft', socket.username);
    }
  });
});

// REST API endpoints
app.get('/api/messages', async (req, res) => {
  try {
    const messages = await Message.find({ isPrivate: false }).sort({ timestamp: 1 });
    res.json(messages);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/messages/private/:username', async (req, res) => {
  try {
    const { username } = req.params;
    const { with: otherUser } = req.query;
    
    const messages = await Message.find({
      isPrivate: true,
      $or: [
        { username: username, recipient: otherUser },
        { username: otherUser, recipient: username }
      ]
    }).sort({ timestamp: 1 });
    
    res.json(messages);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/users/active', async (req, res) => {
  try {
    const activeUsers = Array.from(connectedUsers.keys());
    res.json({ activeUsers });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all users who have exchanged private messages with current user
app.get('/api/users/conversations/:username', async (req, res) => {
  try {
    const { username } = req.params;
    
    const conversations = await Message.aggregate([
      {
        $match: {
          isPrivate: true,
          $or: [
            { username: username },
            { recipient: username }
          ]
        }
      },
      {
        $group: {
          _id: {
            $cond: [
              { $eq: ['$username', username] },
              '$recipient',
              '$username'
            ]
          },
          lastMessage: { $last: '$message' },
          lastTimestamp: { $last: '$timestamp' },
          messageCount: { $sum: 1 }
        }
      },
      {
        $project: {
          username: '$_id',
          lastMessage: 1,
          lastTimestamp: 1,
          messageCount: 1,
          _id: 0
        }
      },
      { $sort: { lastTimestamp: -1 } }
    ]);
    
    res.json(conversations);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/messages/:id', async (req, res) => {
  try {
    await Message.findOneAndDelete({ id: req.params.id });
    io.emit('messageDeleted', req.params.id);
    res.json({ message: 'Message deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/messages', async (req, res) => {
  try {
    await Message.deleteMany({});
    io.emit('chatCleared');
    res.json({ message: 'Chat cleared' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    service: SERVICE_NAME,
    kafka: kafkaConnected ? 'connected' : 'disconnected',
    onlineUsers: connectedUsers.size,
    timestamp: new Date().toISOString()
  });
});

// Prometheus metrics endpoint
app.get('/prometheus', async (req, res) => {
  try {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  } catch (error) {
    res.status(500).end(error);
  }
});

// Metrics endpoint (JSON only, no external stack)
app.get('/metrics', async (req, res) => {
  const mem = process.memoryUsage();
  const cpu = process.cpuUsage();
  const upMs = Date.now() - metrics.startTime;
  
  // Check dependencies
  let mongoStatus = 'connected';
  let redisStatus = 'connected';
  let kafkaStatus = 'connected';
  
  try {
    await mongoose.connection.db.admin().ping();
  } catch (e) {
    mongoStatus = 'disconnected';
  }
  
  try {
    await redisClient.ping();
  } catch (e) {
    redisStatus = 'disconnected';
  }
  
  try {
    // Kafka status is harder to check, use producer state
    kafkaStatus = producer ? 'connected' : 'disconnected';
  } catch (e) {
    kafkaStatus = 'disconnected';
  }
  
  const healthyDeps = [mongoStatus, redisStatus, kafkaStatus].filter(s => s === 'connected').length;
  const status = healthyDeps === 3 ? 'healthy' : healthyDeps >= 2 ? 'degraded' : 'unhealthy';
  
  res.json({
    service: SERVICE_NAME,
    status: status,
    uptimeMs: upMs,
    requestsTotal: metrics.requestsTotal,
    requestsByRoute: metrics.requestsByRoute,
    errorsTotal: metrics.errorsTotal,
    errorRate: metrics.requestsTotal > 0 ? Math.round(metrics.errorsTotal / metrics.requestsTotal * 100 * 100) / 100 : 0,
    latency: latencyStats(),
    resources: {
      memoryMB: Math.round(mem.heapUsed / 1024 / 1024 * 100) / 100,
      cpuPercent: Math.round(process.cpuUsage().user / 1000000 * 100) / 100,
      connections: connectedUsers.size,
      eventLoopDelay: Math.round(Number(process.hrtime.bigint()) / 1000000)
    },
    dependencies: {
      mongodb: { status: mongoStatus, type: 'MongoDB' },
      redis: { status: redisStatus, type: 'Redis' },
      kafka: { status: kafkaStatus, type: 'Kafka' }
    },
    business: {
      totalMessages: metrics.chatMessagesTotal,
      onlineUsers: connectedUsers.size
    },
    deployment: deploymentLabels,
    timestamp: new Date().toISOString()
  });
});

const PORT = process.env.PORT || 3001;

// Start server
async function startServer() {
  try {
    // Start server first
    server.listen(PORT, () => {
      logger.info('Server started', { port: PORT });
    });
    
    // Initialize Kafka in background (non-blocking)
    initKafka().catch(error => {
      logger.warn('Kafka init failed', { error: String(error) });
    });
  } catch (error) {
    recordError('server_startup');
    logger.error('Server start failed', { error: String(error) });
  }
}

startServer();

// Export server for tests
module.exports = server;
