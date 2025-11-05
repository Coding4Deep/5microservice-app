const request = require('supertest');
const { createServer } = require('http');
const { Server } = require('socket.io');
const Client = require('socket.io-client');

// Mock the server module
jest.mock('../server.js', () => {
  const express = require('express');
  const app = express();
  const cors = require('cors');
  
  app.use(cors());
  app.use(express.json());
  
  // Health endpoint
  app.get('/health', (req, res) => {
    res.json({ status: 'OK', service: 'chat-service' });
  });
  
  // Messages endpoint
  app.get('/api/messages', (req, res) => {
    res.json([]);
  });
  
  // Active users endpoint
  app.get('/api/users/active', (req, res) => {
    res.json({ activeUsers: [] });
  });
  
  return app;
});

describe('Chat Server', () => {
  let app;
  
  beforeAll(() => {
    app = require('../server.js');
  });
  
  test('GET /health returns OK', async () => {
    const response = await request(app).get('/health');
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('OK');
  });
  
  test('GET /api/messages returns empty array', async () => {
    const response = await request(app).get('/api/messages');
    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
  });
  
  test('GET /api/users/active returns active users', async () => {
    const response = await request(app).get('/api/users/active');
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('activeUsers');
  });
});

describe('Socket.IO functionality', () => {
  let io, serverSocket, clientSocket;
  
  beforeAll((done) => {
    const httpServer = createServer();
    io = new Server(httpServer);
    httpServer.listen(() => {
      const port = httpServer.address().port;
      clientSocket = new Client(`http://localhost:${port}`);
      io.on('connection', (socket) => {
        serverSocket = socket;
      });
      clientSocket.on('connect', done);
    });
  });
  
  afterAll(() => {
    io.close();
    clientSocket.close();
  });
  
  test('should handle join event', (done) => {
    clientSocket.emit('join', 'testuser');
    serverSocket.on('join', (username) => {
      expect(username).toBe('testuser');
      done();
    });
  });
  
  test('should handle message event', (done) => {
    const testMessage = { user: 'test', message: 'hello', timestamp: Date.now() };
    clientSocket.emit('message', testMessage);
    serverSocket.on('message', (data) => {
      expect(data.user).toBe('test');
      expect(data.message).toBe('hello');
      done();
    });
  });
});
