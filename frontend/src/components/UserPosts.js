import getConfig from '../config';
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

const UserPosts = () => {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newPost, setNewPost] = useState({ caption: '', image: null });
  const [creating, setCreating] = useState(false);
  
  const { token } = useAuth();
  const config = getConfig();
  const POSTS_SERVICE_URL = config.POSTS_SERVICE_URL;

  useEffect(() => {
    fetchMyPosts();
  }, []);

  const fetchMyPosts = async () => {
    try {
      const response = await fetch(`${POSTS_SERVICE_URL}/api/posts/my`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setPosts(data);
      } else {
        setError('Failed to load posts');
      }
    } catch (err) {
      setError('Cannot connect to posts service');
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePost = async (e) => {
    e.preventDefault();
    if (!newPost.image || !newPost.caption.trim()) {
      setError('Please provide both image and caption');
      return;
    }

    setCreating(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('image', newPost.image);
      formData.append('caption', newPost.caption);

      const response = await fetch(`${POSTS_SERVICE_URL}/api/posts`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (response.ok) {
        setNewPost({ caption: '', image: null });
        setShowCreateForm(false);
        fetchMyPosts();
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to create post');
      }
    } catch (err) {
      setError('Error creating post');
    } finally {
      setCreating(false);
    }
  };

  const handleDeletePost = async (postId) => {
    if (!window.confirm('Are you sure you want to delete this post?')) {
      return;
    }

    try {
      const response = await fetch(`${POSTS_SERVICE_URL}/api/posts/${postId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        setPosts(posts.filter(post => post.id !== postId));
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to delete post');
      }
    } catch (err) {
      setError('Error deleting post');
    }
  };

  if (loading) {
    return <div style={styles.loading}>Loading your posts...</div>;
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h3>My Posts</h3>
        <button 
          onClick={() => setShowCreateForm(!showCreateForm)}
          style={styles.createButton}
        >
          {showCreateForm ? 'Cancel' : '+ Add New Post'}
        </button>
      </div>

      {error && <div style={styles.error}>{error}</div>}

      {showCreateForm && (
        <div style={styles.createForm}>
          <h4>Create New Post</h4>
          <form onSubmit={handleCreatePost}>
            <div style={styles.inputGroup}>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setNewPost({...newPost, image: e.target.files[0]})}
                style={styles.fileInput}
                required
              />
            </div>
            <div style={styles.inputGroup}>
              <textarea
                placeholder="Write a caption..."
                value={newPost.caption}
                onChange={(e) => setNewPost({...newPost, caption: e.target.value})}
                style={styles.textarea}
                maxLength={500}
                required
              />
            </div>
            <div style={styles.formButtons}>
              <button 
                type="submit" 
                disabled={creating}
                style={styles.submitButton}
              >
                {creating ? 'Creating...' : 'Create Post'}
              </button>
              <button 
                type="button"
                onClick={() => setShowCreateForm(false)}
                style={styles.cancelButton}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div style={styles.postsGrid}>
        {posts.length === 0 ? (
          <div style={styles.emptyState}>
            <p>You haven't created any posts yet.</p>
            <button 
              onClick={() => setShowCreateForm(true)}
              style={styles.createButton}
            >
              Create Your First Post
            </button>
          </div>
        ) : (
          posts.map(post => (
            <div key={post.id} style={styles.postCard}>
              <div style={styles.postHeader}>
                <span style={styles.postDate}>
                  {new Date(post.created_at).toLocaleDateString()}
                </span>
                <button 
                  onClick={() => handleDeletePost(post.id)}
                  style={styles.deleteButton}
                >
                  🗑️ Delete
                </button>
              </div>
              <img 
                src={`${POSTS_SERVICE_URL}${post.image_url}`}
                alt="Post"
                style={styles.postImage}
              />
              <div style={styles.postContent}>
                <p style={styles.caption}>{post.caption}</p>
                <div style={styles.postStats}>
                  <span>❤️ {post.likes_count} likes</span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

const styles = {
  container: {
    marginTop: '30px',
    borderTop: '1px solid #dee2e6',
    paddingTop: '30px'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px'
  },
  createButton: {
    padding: '10px 20px',
    backgroundColor: '#28a745',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 'bold'
  },
  createForm: {
    backgroundColor: '#f8f9fa',
    padding: '20px',
    borderRadius: '8px',
    marginBottom: '20px',
    border: '1px solid #dee2e6'
  },
  inputGroup: {
    marginBottom: '15px'
  },
  fileInput: {
    width: '100%',
    padding: '10px',
    border: '1px solid #ced4da',
    borderRadius: '4px'
  },
  textarea: {
    width: '100%',
    minHeight: '80px',
    padding: '12px',
    border: '1px solid #ced4da',
    borderRadius: '4px',
    fontSize: '14px',
    resize: 'vertical'
  },
  formButtons: {
    display: 'flex',
    gap: '10px'
  },
  submitButton: {
    padding: '10px 20px',
    backgroundColor: '#007bff',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer'
  },
  cancelButton: {
    padding: '10px 20px',
    backgroundColor: '#6c757d',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer'
  },
  postsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
    gap: '20px'
  },
  emptyState: {
    textAlign: 'center',
    padding: '40px',
    color: '#6c757d'
  },
  postCard: {
    backgroundColor: 'white',
    border: '1px solid #dee2e6',
    borderRadius: '8px',
    overflow: 'hidden',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
  },
  postHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '10px 15px',
    backgroundColor: '#f8f9fa',
    borderBottom: '1px solid #dee2e6'
  },
  postDate: {
    fontSize: '12px',
    color: '#6c757d'
  },
  deleteButton: {
    padding: '5px 10px',
    backgroundColor: '#dc3545',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '12px'
  },
  postImage: {
    width: '100%',
    height: '200px',
    objectFit: 'cover'
  },
  postContent: {
    padding: '15px'
  },
  caption: {
    margin: '0 0 10px 0',
    fontSize: '14px',
    lineHeight: '1.4'
  },
  postStats: {
    fontSize: '12px',
    color: '#6c757d'
  },
  loading: {
    textAlign: 'center',
    padding: '20px',
    color: '#6c757d'
  },
  error: {
    backgroundColor: '#f8d7da',
    color: '#721c24',
    padding: '10px',
    borderRadius: '4px',
    marginBottom: '20px'
  }
};

export default UserPosts;
