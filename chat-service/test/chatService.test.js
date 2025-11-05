const request = require('supertest');
const ChatService = require('../src/chatService');

describe('ChatService', () => {
  let chatService;
  let app;

  beforeEach(() => {
    chatService = new ChatService();
    app = chatService.getApp();
  });

  describe('Health endpoint', () => {
    test('GET /health returns OK status', async () => {
      const response = await request(app).get('/health');
      expect(response.status).toBe(200);
      expect(response.body.status).toBe('OK');
      expect(response.body.service).toBe('chat-service');
    });
  });

  describe('Messages functionality', () => {
    test('GET /api/messages returns empty array initially', async () => {
      const response = await request(app).get('/api/messages');
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(0);
    });

    test('POST /api/messages adds a new message', async () => {
      const messageData = {
        user: 'testuser',
        message: 'Hello world'
      };

      const response = await request(app)
        .post('/api/messages')
        .send(messageData);

      expect(response.status).toBe(200);
      expect(response.body.user).toBe('testuser');
      expect(response.body.message).toBe('Hello world');
      expect(response.body.id).toBeDefined();
      expect(response.body.timestamp).toBeDefined();
    });

    test('addMessage method works correctly', () => {
      const messageData = { user: 'test', message: 'test message' };
      const result = chatService.addMessage(messageData);
      
      expect(result.user).toBe('test');
      expect(result.message).toBe('test message');
      expect(result.id).toBeDefined();
      expect(result.timestamp).toBeDefined();
    });
  });

  describe('Active users functionality', () => {
    test('GET /api/users/active returns empty array initially', async () => {
      const response = await request(app).get('/api/users/active');
      expect(response.status).toBe(200);
      expect(response.body.activeUsers).toEqual([]);
    });

    test('addUser method adds user to active list', () => {
      const users = chatService.addUser('testuser');
      expect(users).toContain('testuser');
      expect(users.length).toBe(1);
    });

    test('removeUser method removes user from active list', () => {
      chatService.addUser('testuser');
      const users = chatService.removeUser('testuser');
      expect(users).not.toContain('testuser');
      expect(users.length).toBe(0);
    });

    test('addUser prevents duplicates', () => {
      chatService.addUser('testuser');
      const users = chatService.addUser('testuser');
      expect(users.length).toBe(1);
    });
  });

  describe('Integration tests', () => {
    test('Messages persist across requests', async () => {
      // Add a message
      await request(app)
        .post('/api/messages')
        .send({ user: 'user1', message: 'First message' });

      // Get messages
      const response = await request(app).get('/api/messages');
      expect(response.body.length).toBe(1);
      expect(response.body[0].message).toBe('First message');
    });
  });
});
