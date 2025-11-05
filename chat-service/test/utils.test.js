// Test utility functions and modules separately
const { validateMessage, sanitizeInput, formatTimestamp } = require('./utils');

describe('Chat Service Utils', () => {
  describe('validateMessage', () => {
    test('should validate correct message', () => {
      const message = { username: 'testuser', message: 'Hello world' };
      expect(validateMessage(message)).toBe(true);
    });

    test('should reject empty message', () => {
      const message = { username: 'testuser', message: '' };
      expect(validateMessage(message)).toBe(false);
    });

    test('should reject missing username', () => {
      const message = { message: 'Hello world' };
      expect(validateMessage(message)).toBe(false);
    });

    test('should reject too long message', () => {
      const message = { username: 'testuser', message: 'a'.repeat(1001) };
      expect(validateMessage(message)).toBe(false);
    });
  });

  describe('sanitizeInput', () => {
    test('should remove HTML tags', () => {
      const input = '<script>alert("xss")</script>Hello';
      expect(sanitizeInput(input)).toBe('alert("xss")Hello');
    });

    test('should handle normal text', () => {
      const input = 'Normal message';
      expect(sanitizeInput(input)).toBe('Normal message');
    });
  });

  describe('formatTimestamp', () => {
    test('should format date correctly', () => {
      const date = new Date('2023-01-01T12:00:00Z');
      const formatted = formatTimestamp(date);
      expect(formatted).toMatch(/\d{4}-\d{2}-\d{2}/);
    });
  });
});
