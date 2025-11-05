const express = require('express');
const cors = require('cors');

class ChatService {
  constructor() {
    this.app = express();
    this.activeUsers = new Set();
    this.messages = [];
    this.setupMiddleware();
    this.setupRoutes();
  }

  setupMiddleware() {
    this.app.use(cors());
    this.app.use(express.json());
  }

  setupRoutes() {
    this.app.get('/health', (req, res) => {
      res.json({ status: 'OK', service: 'chat-service' });
    });

    this.app.get('/api/messages', (req, res) => {
      res.json(this.messages);
    });

    this.app.get('/api/users/active', (req, res) => {
      res.json({ activeUsers: Array.from(this.activeUsers) });
    });

    this.app.post('/api/messages', (req, res) => {
      const message = this.addMessage(req.body);
      res.json(message);
    });
  }

  addMessage(messageData) {
    const message = {
      id: Date.now(),
      user: messageData.user,
      message: messageData.message,
      timestamp: new Date().toISOString()
    };
    this.messages.push(message);
    return message;
  }

  addUser(username) {
    this.activeUsers.add(username);
    return Array.from(this.activeUsers);
  }

  removeUser(username) {
    this.activeUsers.delete(username);
    return Array.from(this.activeUsers);
  }

  getApp() {
    return this.app;
  }
}

module.exports = ChatService;
