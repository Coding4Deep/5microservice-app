// Utility functions for chat service
function validateMessage(messageData) {
  if (!messageData || !messageData.username || !messageData.message) {
    return false;
  }
  
  if (messageData.message.trim().length === 0) {
    return false;
  }
  
  if (messageData.message.length > 1000) {
    return false;
  }
  
  return true;
}

function sanitizeInput(input) {
  if (typeof input !== 'string') return '';
  
  // Remove HTML tags
  return input.replace(/<[^>]*>/g, '');
}

function formatTimestamp(date) {
  return date.toISOString().split('T')[0];
}

function generateMessageId() {
  return Date.now().toString() + Math.random().toString(36).substr(2, 9);
}

function isValidUsername(username) {
  if (!username || typeof username !== 'string') return false;
  return username.length >= 3 && username.length <= 50 && /^[a-zA-Z0-9_]+$/.test(username);
}

module.exports = {
  validateMessage,
  sanitizeInput,
  formatTimestamp,
  generateMessageId,
  isValidUsername
};
