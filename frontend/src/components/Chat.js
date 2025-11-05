import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import getConfig from '../config';
import io from 'socket.io-client';

const Chat = () => {
  const [messages, setMessages] = useState([]);
  const [privateMessages, setPrivateMessages] = useState({});
  const [newMessage, setNewMessage] = useState('');
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [chatMode, setChatMode] = useState('public');
  const messagesEndRef = useRef(null);
  const { username, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const config = getConfig();
  const CHAT_SERVICE_URL = config.CHAT_SERVICE_URL;

  useEffect(() => {
    if (location.state?.selectedUser && location.state?.chatMode === 'private') {
      setSelectedUser(location.state.selectedUser);
      setChatMode('private');
    }
  }, [location.state]);

  useEffect(() => {
    if (!username) {
      navigate('/login');
      return;
    }

    fetchConversations();
    const newSocket = io(CHAT_SERVICE_URL);
    setSocket(newSocket);

    newSocket.on('connect', () => {
      setConnected(true);
      newSocket.emit('join', username);
    });

    newSocket.on('disconnect', () => {
      setConnected(false);
    });

    newSocket.on('messageHistory', (history) => {
      setMessages(history || []);
    });

    newSocket.on('privateMessageHistory', (history) => {
      const grouped = {};
      (history || []).forEach(msg => {
        const otherUser = msg.username === username ? msg.recipient : msg.username;
        if (!grouped[otherUser]) grouped[otherUser] = [];
        grouped[otherUser].push(msg);
      });
      setPrivateMessages(grouped);
    });

    newSocket.on('message', (message) => {
      setMessages(prev => [...prev, message]);
    });

    newSocket.on('privateMessage', (message) => {
      const otherUser = message.username === username ? message.recipient : message.username;
      setPrivateMessages(prev => ({
        ...prev,
        [otherUser]: [...(prev[otherUser] || []), message]
      }));
      fetchConversations(); // Refresh conversations list
    });

    newSocket.on('activeUsers', (users) => {
      setOnlineUsers((users || []).filter(u => u !== username));
    });

    newSocket.on('messageDeleted', (messageId) => {
      setMessages(prev => prev.filter(msg => msg.id !== messageId));
      // Also remove from private messages
      setPrivateMessages(prev => {
        const updated = { ...prev };
        Object.keys(updated).forEach(user => {
          updated[user] = updated[user].filter(msg => msg.id !== messageId);
        });
        return updated;
      });
    });

    newSocket.on('chatCleared', () => {
      setMessages([]);
    });

    return () => newSocket.close();
  }, [username, navigate]);

  const fetchConversations = async () => {
    try {
      const response = await fetch(`${CHAT_SERVICE_URL}/api/users/conversations/${username}`);
      if (response.ok) {
        const data = await response.json();
        setConversations(data);
      }
    } catch (error) {
      console.error('Error fetching conversations:', error);
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, privateMessages, selectedUser]);

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !socket || !connected) return;

    if (chatMode === 'public') {
      socket.emit('sendMessage', {
        username,
        message: newMessage.trim()
      });
    } else if (selectedUser) {
      socket.emit('sendPrivateMessage', {
        username,
        message: newMessage.trim(),
        recipient: selectedUser
      });
    }
    setNewMessage('');
  };

  const handlePublicChatClick = () => {
    setChatMode('public');
    setSelectedUser(null);
  };

  const handleUserClick = async (user) => {
    setSelectedUser(user);
    setChatMode('private');
    
    // Load private message history for this user
    try {
      const response = await fetch(`${CHAT_SERVICE_URL}/api/messages/private/${username}?with=${user}`);
      if (response.ok) {
        const messages = await response.json();
        setPrivateMessages(prev => ({
          ...prev,
          [user]: messages
        }));
      }
    } catch (error) {
      console.error('Error loading private messages:', error);
    }
  };

  const handleDeleteMessage = (messageId) => {
    if (socket && connected) {
      socket.emit('deleteMessage', messageId);
    }
  };

  const handleClearChat = () => {
    if (socket && connected && window.confirm('Clear all public messages?')) {
      socket.emit('clearChat');
    }
  };

  const handleLogout = async () => {
    if (socket) socket.close();
    await logout();
    navigate('/login');
  };

  const currentMessages = chatMode === 'public' ? messages : (privateMessages[selectedUser] || []);
  const offlineUsers = conversations.filter(conv => !onlineUsers.includes(conv.username));

  return (
    <div style={styles.container}>
      {/* Sidebar */}
      <div style={styles.sidebar}>
        <h3>Chat</h3>
        
        <button 
          onClick={handlePublicChatClick}
          style={{
            ...styles.modeButton,
            backgroundColor: chatMode === 'public' ? '#007bff' : '#e9ecef',
            color: chatMode === 'public' ? 'white' : '#495057'
          }}
        >
          📢 Public Chat
        </button>
        
        <h4 style={styles.sectionTitle}>Online Users ({onlineUsers.length})</h4>
        <div style={styles.usersList}>
          {onlineUsers.map(user => (
            <button
              key={user}
              onClick={() => handleUserClick(user)}
              style={{
                ...styles.userButton,
                backgroundColor: selectedUser === user ? '#007bff' : '#f8f9fa',
                color: selectedUser === user ? 'white' : '#495057'
              }}
            >
              <span>🟢 {user}</span>
              {privateMessages[user] && (
                <span style={styles.messageCount}>
                  {privateMessages[user].length}
                </span>
              )}
            </button>
          ))}
          {onlineUsers.length === 0 && (
            <div style={styles.noUsers}>No users online</div>
          )}
        </div>

        <h4 style={styles.sectionTitle}>Recent Conversations</h4>
        <div style={styles.usersList}>
          {offlineUsers.map(conv => (
            <button
              key={conv.username}
              onClick={() => handleUserClick(conv.username)}
              style={{
                ...styles.userButton,
                backgroundColor: selectedUser === conv.username ? '#007bff' : '#fff3cd',
                color: selectedUser === conv.username ? 'white' : '#856404',
                border: '1px solid #ffeaa7'
              }}
            >
              <span>⚫ {conv.username}</span>
              <span style={styles.messageCount}>
                {conv.messageCount}
              </span>
            </button>
          ))}
          {offlineUsers.length === 0 && (
            <div style={styles.noUsers}>No conversations yet</div>
          )}
        </div>

        <div style={styles.statusInfo}>
          <div>Status: {connected ? '🟢 Online' : '🔴 Offline'}</div>
          <div>You: {username}</div>
          {chatMode === 'private' && selectedUser && (
            <div>
              Chatting with: {selectedUser}
              {onlineUsers.includes(selectedUser) ? ' 🟢' : ' ⚫'}
            </div>
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div style={styles.chatArea}>
        <div style={styles.header}>
          <h2>
            {chatMode === 'public' 
              ? '📢 Public Chat Room' 
              : `💬 ${selectedUser ? 
                  `Chat with ${selectedUser} ${onlineUsers.includes(selectedUser) ? '🟢' : '⚫'}` 
                  : 'Select User'}`
            }
          </h2>
          <div>
            <button onClick={() => navigate('/posts')} style={styles.headerButton}>
              📸 Posts
            </button>
            <button onClick={() => navigate('/profile')} style={styles.headerButton}>
              My Profile
            </button>
            <button onClick={() => navigate('/dashboard')} style={styles.headerButton}>
              Dashboard
            </button>
            {chatMode === 'public' && (
              <button onClick={handleClearChat} style={styles.clearButton}>
                Clear Chat
              </button>
            )}
            <button onClick={handleLogout} style={styles.logoutButton}>
              Logout
            </button>
          </div>
        </div>

        <div style={styles.messagesContainer}>
          {currentMessages.length > 0 ? (
            currentMessages.map((message, index) => (
              <div
                key={message.id || message._id || index}
                style={{
                  ...styles.message,
                  alignSelf: message.username === username ? 'flex-end' : 'flex-start',
                  backgroundColor: message.username === username ? '#007bff' : '#e9ecef',
                  color: message.username === username ? 'white' : '#495057'
                }}
              >
                <div style={styles.messageHeader}>
                  <strong>{message.username}</strong>
                  <span style={styles.timestamp}>
                    {new Date(message.timestamp).toLocaleTimeString()}
                  </span>
                  {message.username === username && (
                    <button
                      onClick={() => handleDeleteMessage(message.id)}
                      style={styles.deleteButton}
                      title="Delete message"
                    >
                      ×
                    </button>
                  )}
                </div>
                <div>{message.message}</div>
              </div>
            ))
          ) : (
            <div style={styles.emptyState}>
              {chatMode === 'public' 
                ? '💬 No messages yet. Start the conversation!' 
                : selectedUser 
                  ? `💬 No messages with ${selectedUser} yet. ${onlineUsers.includes(selectedUser) ? 'They are online!' : 'They will see your message when they come online.'}`
                  : '👈 Select a user from the sidebar to start chatting'
              }
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <form onSubmit={handleSendMessage} style={styles.messageForm}>
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder={
              chatMode === 'public' 
                ? "Type your message..." 
                : selectedUser 
                  ? `Message ${selectedUser}${onlineUsers.includes(selectedUser) ? ' (online)' : ' (offline - will receive when online)'}...` 
                  : "Select a user first"
            }
            style={styles.messageInput}
            disabled={!connected || (chatMode === 'private' && !selectedUser)}
          />
          <button
            type="submit"
            disabled={!connected || !newMessage.trim() || (chatMode === 'private' && !selectedUser)}
            style={styles.sendButton}
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
};

const styles = {
  container: {
    display: 'flex',
    height: '100vh',
    fontFamily: 'Arial, sans-serif'
  },
  sidebar: {
    width: '320px',
    backgroundColor: '#f8f9fa',
    borderRight: '1px solid #dee2e6',
    padding: '20px',
    display: 'flex',
    flexDirection: 'column',
    overflowY: 'auto'
  },
  modeButton: {
    width: '100%',
    padding: '12px',
    border: '1px solid #dee2e6',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '16px',
    fontWeight: 'bold',
    marginBottom: '20px'
  },
  sectionTitle: {
    fontSize: '14px',
    fontWeight: 'bold',
    marginBottom: '10px',
    marginTop: '15px',
    color: '#495057'
  },
  usersList: {
    marginBottom: '15px'
  },
  userButton: {
    width: '100%',
    padding: '10px',
    border: '1px solid #dee2e6',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
    marginBottom: '5px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  messageCount: {
    backgroundColor: '#dc3545',
    color: 'white',
    borderRadius: '12px',
    padding: '2px 8px',
    fontSize: '12px',
    fontWeight: 'bold'
  },
  noUsers: {
    textAlign: 'center',
    color: '#6c757d',
    padding: '10px',
    fontStyle: 'italic',
    fontSize: '12px'
  },
  statusInfo: {
    marginTop: 'auto',
    padding: '15px',
    backgroundColor: '#e9ecef',
    borderRadius: '6px',
    fontSize: '12px',
    color: '#495057'
  },
  chatArea: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '20px',
    backgroundColor: '#ffffff',
    borderBottom: '1px solid #dee2e6'
  },
  headerButton: {
    padding: '8px 16px',
    backgroundColor: '#6c757d',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    marginRight: '10px'
  },
  clearButton: {
    padding: '8px 16px',
    backgroundColor: '#ffc107',
    color: 'black',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    marginRight: '10px'
  },
  logoutButton: {
    padding: '8px 16px',
    backgroundColor: '#dc3545',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer'
  },
  messagesContainer: {
    flex: 1,
    padding: '20px',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px'
  },
  message: {
    maxWidth: '70%',
    padding: '12px',
    borderRadius: '12px',
    wordWrap: 'break-word'
  },
  messageHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '4px',
    fontSize: '12px',
    opacity: 0.8
  },
  timestamp: {
    fontSize: '11px'
  },
  deleteButton: {
    background: 'none',
    border: 'none',
    color: 'inherit',
    cursor: 'pointer',
    fontSize: '16px',
    padding: '0 4px',
    borderRadius: '50%',
    opacity: 0.7
  },
  emptyState: {
    textAlign: 'center',
    color: '#6c757d',
    padding: '40px',
    fontSize: '16px'
  },
  messageForm: {
    display: 'flex',
    padding: '20px',
    backgroundColor: '#f8f9fa',
    borderTop: '1px solid #dee2e6'
  },
  messageInput: {
    flex: 1,
    padding: '12px',
    border: '1px solid #ced4da',
    borderRadius: '6px',
    marginRight: '10px',
    fontSize: '14px'
  },
  sendButton: {
    padding: '12px 24px',
    backgroundColor: '#007bff',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 'bold'
  }
};

export default Chat;
