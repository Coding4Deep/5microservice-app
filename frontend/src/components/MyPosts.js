import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import getConfig from '../config';

const MyPosts = () => {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [uploading, setUploading] = useState(false);
  const { username, token } = useAuth();
  const navigate = useNavigate();

  const config = getConfig();
  const POSTS_SERVICE_URL = config.POSTS_SERVICE_URL;

  useEffect(() => {
    fetchMyPosts();
  }, []);

  const fetchMyPosts = async () => {
    try {
      const response = await fetch(`${POSTS_SERVICE_URL}/api/posts/my`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setPosts(data || []);
      } else {
        setError('Failed to fetch posts');
      }
    } catch (err) {
      setError('Cannot connect to posts service');
    } finally {
      setLoading(false);
    }
  };

  const deletePost = async (postId) => {
    if (!window.confirm('Are you sure you want to delete this post?')) return;
    
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
        alert('Failed to delete post');
      }
    } catch (err) {
      alert('Error deleting post');
    }
  };

  const createPost = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setUploading(true);
    const formData = new FormData();
    formData.append('image', file);
    formData.append('caption', prompt('Enter caption:') || '');

    try {
      const response = await fetch(`${POSTS_SERVICE_URL}/api/posts`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (response.ok) {
        fetchMyPosts();
      } else {
        alert('Failed to create post');
      }
    } catch (err) {
      alert('Error creating post');
    } finally {
      setUploading(false);
    }
  };

  if (loading) return <div style={styles.loading}>Loading posts...</div>;
  if (error) return <div style={styles.error}>Error: {error}</div>;

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1>My Posts</h1>
        <div>
          <input
            type="file"
            accept="image/*"
            onChange={createPost}
            style={styles.fileInput}
            id="post-upload"
            disabled={uploading}
          />
          <label htmlFor="post-upload" style={styles.uploadButton}>
            {uploading ? 'Uploading...' : '📷 Create Post'}
          </label>
          <button onClick={() => navigate('/dashboard')} style={styles.backButton}>
            ← Back to Dashboard
          </button>
        </div>
      </div>

      <div style={styles.postsGrid}>
        {posts.length === 0 ? (
          <div style={styles.emptyState}>
            <h3>No posts yet</h3>
            <p>Upload your first image to get started!</p>
          </div>
        ) : (
          posts.map(post => (
            <div key={post.id} style={styles.postCard}>
              <img 
                src={`${POSTS_SERVICE_URL}${post.image_url}`} 
                alt={post.caption}
                style={styles.postImage}
              />
              <div style={styles.postContent}>
                <p style={styles.caption}>{post.caption}</p>
                <div style={styles.postMeta}>
                  <span>❤️ {post.likes_count}</span>
                  <span>{new Date(post.created_at).toLocaleDateString()}</span>
                </div>
                <button 
                  onClick={() => deletePost(post.id)}
                  style={styles.deleteButton}
                >
                  🗑️ Delete
                </button>
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
    minHeight: '100vh',
    backgroundColor: '#f8f9fa',
    padding: '20px'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '30px',
    padding: '20px',
    backgroundColor: 'white',
    borderRadius: '8px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
  },
  fileInput: {
    display: 'none'
  },
  uploadButton: {
    padding: '12px 20px',
    backgroundColor: '#28a745',
    color: 'white',
    borderRadius: '6px',
    cursor: 'pointer',
    marginRight: '10px',
    fontSize: '14px',
    fontWeight: 'bold'
  },
  backButton: {
    padding: '12px 20px',
    backgroundColor: '#6c757d',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 'bold'
  },
  postsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
    gap: '20px',
    maxWidth: '1200px',
    margin: '0 auto'
  },
  postCard: {
    backgroundColor: 'white',
    borderRadius: '8px',
    overflow: 'hidden',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
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
    color: '#333'
  },
  postMeta: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '12px',
    color: '#6c757d',
    marginBottom: '10px'
  },
  deleteButton: {
    padding: '8px 12px',
    backgroundColor: '#dc3545',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '12px'
  },
  emptyState: {
    textAlign: 'center',
    padding: '40px',
    color: '#6c757d',
    gridColumn: '1 / -1'
  },
  loading: {
    textAlign: 'center',
    padding: '50px',
    fontSize: '18px'
  },
  error: {
    textAlign: 'center',
    padding: '50px',
    color: '#dc3545'
  }
};

export default MyPosts;
