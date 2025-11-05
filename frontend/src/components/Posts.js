import getConfig from '../config';
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Posts = () => {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newPost, setNewPost] = useState({ caption: '', image: null });
  const [creating, setCreating] = useState(false);
  const [imagePreview, setImagePreview] = useState(null);
  const [resizedImage, setResizedImage] = useState(null);
  const canvasRef = useRef(null);
  const { username, token, logout } = useAuth();
  const navigate = useNavigate();

  const config = getConfig();
  const POSTS_SERVICE_URL = config.POSTS_SERVICE_URL;

  useEffect(() => {
    fetchPosts();
  }, []);

  const fetchPosts = async () => {
    try {
      setError(null);
      const response = await fetch(`${POSTS_SERVICE_URL}/api/posts`);
      if (response.ok) {
        const data = await response.json();
        setPosts(data || []);
      } else {
        setError(`Failed to fetch posts: ${response.status}`);
      }
    } catch (error) {
      console.error('Error fetching posts:', error);
      setError(`Connection error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const resizeImage = (file, maxWidth = 800, maxHeight = 600, quality = 0.8) => {
    return new Promise((resolve) => {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      const img = new Image();
      
      img.onload = () => {
        let { width, height } = img;
        
        // Calculate new dimensions
        if (width > height) {
          if (width > maxWidth) {
            height = (height * maxWidth) / width;
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = (width * maxHeight) / height;
            height = maxHeight;
          }
        }
        
        canvas.width = width;
        canvas.height = height;
        
        // Draw and resize
        ctx.drawImage(img, 0, 0, width, height);
        
        canvas.toBlob(resolve, 'image/jpeg', quality);
      };
      
      img.src = URL.createObjectURL(file);
    });
  };

  const handleImageSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Create preview
    const previewUrl = URL.createObjectURL(file);
    setImagePreview(previewUrl);

    // Resize image
    const resized = await resizeImage(file);
    setResizedImage(resized);
    setNewPost({ ...newPost, image: resized });
  };

  const handleCreatePost = async (e) => {
    e.preventDefault();
    if (!newPost.image || creating) return;

    setCreating(true);
    const formData = new FormData();
    formData.append('image', newPost.image);
    formData.append('caption', newPost.caption);

    try {
      const response = await fetch(`${POSTS_SERVICE_URL}/api/posts`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (response.ok) {
        setShowCreateModal(false);
        setNewPost({ caption: '', image: null });
        fetchPosts(); // Refresh posts
      } else {
        const errorData = await response.text();
        alert(`Failed to create post: ${errorData}`);
      }
    } catch (error) {
      console.error('Error creating post:', error);
      alert(`Error creating post: ${error.message}`);
    } finally {
      setCreating(false);
    }
  };

  const handleLike = async (postId) => {
    try {
      const response = await fetch(`${POSTS_SERVICE_URL}/api/posts/${postId}/like`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        fetchPosts(); // Refresh to get updated like count
      }
    } catch (error) {
      console.error('Error toggling like:', error);
    }
  };

  const clearImage = () => {
    setImagePreview(null);
    setResizedImage(null);
    setNewPost({ ...newPost, image: null });
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.header}>
          <h1>📸 Posts</h1>
          <div>
            <button onClick={() => navigate('/dashboard')} style={styles.navButton}>
              Dashboard
            </button>
          </div>
        </div>
        <div style={styles.loading}>Loading posts...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.container}>
        <div style={styles.header}>
          <h1>📸 Posts</h1>
          <div>
            <button onClick={() => navigate('/dashboard')} style={styles.navButton}>
              Dashboard
            </button>
          </div>
        </div>
        <div style={styles.error}>
          <h3>Error loading posts</h3>
          <p>{error}</p>
          <button onClick={fetchPosts} style={styles.retryButton}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <h1>📸 Posts</h1>
        <div>
          <button onClick={() => setShowCreateModal(true)} style={styles.createButton}>
            + Create Post
          </button>
          <button onClick={() => navigate('/dashboard')} style={styles.navButton}>
            Dashboard
          </button>
          <button onClick={() => navigate('/chat')} style={styles.navButton}>
            Chat
          </button>
          <button onClick={() => navigate('/profile')} style={styles.navButton}>
            Profile
          </button>
          <button onClick={logout} style={styles.logoutButton}>
            Logout
          </button>
        </div>
      </div>

      {/* Posts Feed */}
      <div style={styles.feed}>
        {posts.length === 0 ? (
          <div style={styles.emptyState}>
            <h3>No posts yet</h3>
            <p>Be the first to share a post!</p>
            <button onClick={() => setShowCreateModal(true)} style={styles.createButton}>
              Create First Post
            </button>
          </div>
        ) : (
          posts.map(post => (
            <div key={post.id} style={styles.post}>
              <div style={styles.postHeader}>
                <div style={styles.userInfo}>
                  <strong>@{post.username}</strong>
                  <span style={styles.timestamp}>{formatDate(post.created_at)}</span>
                </div>
              </div>
              
              <div style={styles.postContent}>
                <img 
                  src={`${POSTS_SERVICE_URL}${post.image_url}`} 
                  alt="Post" 
                  style={styles.postImage}
                  onError={(e) => {
                    e.target.style.display = 'none';
                  }}
                />
                {post.caption && (
                  <p style={styles.caption}>{post.caption}</p>
                )}
              </div>
              
              <div style={styles.postActions}>
                <button 
                  onClick={() => handleLike(post.id)} 
                  style={styles.likeButton}
                >
                  ❤️ {post.likes_count}
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Create Post Modal */}
      {showCreateModal && (
        <div style={styles.modal}>
          <div style={styles.modalContent}>
            <div style={styles.modalHeader}>
              <h3>Create New Post</h3>
              <button 
                onClick={() => setShowCreateModal(false)} 
                style={styles.closeButton}
              >
                ×
              </button>
            </div>
            
            <form onSubmit={handleCreatePost} style={styles.form}>
              <div style={styles.formGroup}>
                <label style={styles.label}>Choose Image:</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageSelect}
                  required
                  style={styles.fileInput}
                />
                
                {imagePreview && (
                  <div style={styles.imagePreviewContainer}>
                    <div style={styles.previewHeader}>
                      <span>Image Preview (will be resized to max 800x600)</span>
                      <button 
                        type="button" 
                        onClick={clearImage}
                        style={styles.clearButton}
                      >
                        ✕ Clear
                      </button>
                    </div>
                    <img 
                      src={imagePreview} 
                      alt="Preview" 
                      style={styles.imagePreview}
                    />
                  </div>
                )}
              </div>
              
              <div style={styles.formGroup}>
                <label style={styles.label}>Caption:</label>
                <textarea
                  value={newPost.caption}
                  onChange={(e) => setNewPost({ ...newPost, caption: e.target.value })}
                  placeholder="Write a caption..."
                  style={styles.textarea}
                  rows="3"
                />
              </div>
              
              <div style={styles.formActions}>
                <button 
                  type="button" 
                  onClick={() => {
                    setShowCreateModal(false);
                    clearImage();
                  }}
                  style={styles.cancelButton}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={!newPost.image || creating}
                  style={{
                    ...styles.submitButton,
                    opacity: (!newPost.image || creating) ? 0.5 : 1
                  }}
                >
                  {creating ? 'Creating...' : 'Create Post'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      
      {/* Hidden canvas for image processing */}
      <canvas ref={canvasRef} style={{ display: 'none' }} />
    </div>
  );
};

const styles = {
  container: {
    minHeight: '100vh',
    backgroundColor: '#f8f9fa',
    fontFamily: 'Arial, sans-serif'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '20px',
    backgroundColor: 'white',
    borderBottom: '1px solid #dee2e6',
    position: 'sticky',
    top: 0,
    zIndex: 100
  },
  createButton: {
    padding: '10px 20px',
    backgroundColor: '#007bff',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    marginRight: '10px',
    fontWeight: 'bold'
  },
  navButton: {
    padding: '8px 16px',
    backgroundColor: '#6c757d',
    color: 'white',
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
  loading: {
    textAlign: 'center',
    padding: '50px',
    fontSize: '18px',
    color: '#6c757d'
  },
  error: {
    textAlign: 'center',
    padding: '50px',
    color: '#dc3545'
  },
  retryButton: {
    padding: '10px 20px',
    backgroundColor: '#007bff',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    marginTop: '10px'
  },
  feed: {
    maxWidth: '600px',
    margin: '0 auto',
    padding: '20px'
  },
  emptyState: {
    textAlign: 'center',
    padding: '50px',
    backgroundColor: 'white',
    borderRadius: '8px',
    color: '#6c757d'
  },
  post: {
    backgroundColor: 'white',
    borderRadius: '8px',
    marginBottom: '20px',
    overflow: 'hidden',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
  },
  postHeader: {
    padding: '15px',
    borderBottom: '1px solid #f0f0f0'
  },
  userInfo: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  timestamp: {
    color: '#6c757d',
    fontSize: '14px'
  },
  postContent: {
    padding: '0'
  },
  postImage: {
    width: '100%',
    height: 'auto',
    maxHeight: '500px',
    objectFit: 'cover'
  },
  caption: {
    padding: '15px',
    margin: 0,
    lineHeight: '1.5'
  },
  postActions: {
    padding: '15px',
    borderTop: '1px solid #f0f0f0'
  },
  likeButton: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: '16px',
    color: '#495057'
  },
  modal: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: '8px',
    width: '90%',
    maxWidth: '500px',
    maxHeight: '90vh',
    overflow: 'auto'
  },
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '20px',
    borderBottom: '1px solid #dee2e6'
  },
  closeButton: {
    background: 'none',
    border: 'none',
    fontSize: '24px',
    cursor: 'pointer',
    color: '#6c757d'
  },
  form: {
    padding: '20px'
  },
  formGroup: {
    marginBottom: '20px'
  },
  label: {
    display: 'block',
    marginBottom: '5px',
    fontWeight: 'bold'
  },
  fileInput: {
    width: '100%',
    padding: '10px',
    border: '1px solid #ced4da',
    borderRadius: '4px'
  },
  imagePreviewContainer: {
    marginTop: '10px',
    border: '2px dashed #ddd',
    borderRadius: '8px',
    padding: '10px',
    backgroundColor: '#f9f9f9'
  },
  previewHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '10px',
    fontSize: '14px',
    color: '#666'
  },
  clearButton: {
    background: '#dc3545',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    padding: '4px 8px',
    cursor: 'pointer',
    fontSize: '12px'
  },
  imagePreview: {
    maxWidth: '100%',
    maxHeight: '300px',
    objectFit: 'contain',
    borderRadius: '4px',
    display: 'block',
    margin: '0 auto'
  },
  textarea: {
    width: '100%',
    padding: '10px',
    border: '1px solid #ced4da',
    borderRadius: '4px',
    resize: 'vertical',
    fontFamily: 'inherit'
  },
  formActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '10px'
  },
  cancelButton: {
    padding: '10px 20px',
    backgroundColor: '#6c757d',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer'
  },
  submitButton: {
    padding: '10px 20px',
    backgroundColor: '#007bff',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer'
  }
};

export default Posts;
