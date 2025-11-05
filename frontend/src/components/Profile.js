import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import getConfig from '../config';
import ImageCropModal from './ImageCropModal';

const Profile = () => {
  const [profile, setProfile] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [bio, setBio] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState('');
  const [showCropModal, setShowCropModal] = useState(false);
  const [tempImageData, setTempImageData] = useState(null);
  const [uploading, setUploading] = useState(false);
  
  const { username: urlUsername } = useParams();
  const { username: currentUser, token, logout } = useAuth();
  const navigate = useNavigate();
  
  const profileUsername = urlUsername || currentUser;
  const isOwnProfile = profileUsername === currentUser;
  
  const config = getConfig();
  const PROFILE_SERVICE_URL = config.PROFILE_SERVICE_URL;

  useEffect(() => {
    if (!currentUser) {
      navigate('/login');
      return;
    }
    fetchProfile();
  }, [profileUsername, currentUser, navigate]);

  const fetchProfile = async () => {
    try {
      const response = await fetch(`${PROFILE_SERVICE_URL}/api/profile/${profileUsername}`);
      if (response.ok) {
        const data = await response.json();
        setProfile(data);
        setBio(data.bio || '');
      } else {
        setError('Failed to load profile');
      }
    } catch (err) {
      setError('Cannot connect to profile service');
    } finally {
      setLoading(false);
    }
  };

  const handleImageSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('image', file);

      const response = await fetch(`${PROFILE_SERVICE_URL}/api/profile/${currentUser}/upload-temp-image`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (response.ok) {
        const data = await response.json();
        setTempImageData(data);
        setShowCropModal(true);
      } else {
        const errorData = await response.json();
        setError(errorData.detail || 'Failed to upload image');
      }
    } catch (err) {
      setError('Error uploading image');
    } finally {
      setUploading(false);
    }
  };

  const handleImageSave = async (cropData) => {
    setUploading(true);
    try {
      const response = await fetch(`${PROFILE_SERVICE_URL}/api/profile/${currentUser}/process-image`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(cropData)
      });

      if (response.ok) {
        setSuccess('Profile picture updated successfully!');
        setShowCropModal(false);
        setTempImageData(null);
        fetchProfile(); // Refresh profile data
      } else {
        const errorData = await response.json();
        setError(errorData.detail || 'Failed to save image');
      }
    } catch (err) {
      setError('Error saving image');
    } finally {
      setUploading(false);
    }
  };

  const handleUpdateBio = async (e) => {
    e.preventDefault();
    if (!isOwnProfile) return;

    try {
      const formData = new FormData();
      formData.append('bio', bio);

      const response = await fetch(`${PROFILE_SERVICE_URL}/api/profile/${currentUser}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (response.ok) {
        setSuccess('Bio updated successfully!');
        setIsEditing(false);
        fetchProfile();
      } else {
        const data = await response.json();
        setError(data.detail || 'Failed to update bio');
      }
    } catch (err) {
      setError('Error updating bio');
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (!isOwnProfile) return;

    try {
      const response = await fetch(`${PROFILE_SERVICE_URL}/api/profile/${currentUser}/change-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword
        })
      });

      if (response.ok) {
        setSuccess('Password change request submitted!');
        setCurrentPassword('');
        setNewPassword('');
      } else {
        const data = await response.json();
        setError(data.detail || 'Failed to change password');
      }
    } catch (err) {
      setError('Error changing password');
    }
  };

  if (!currentUser) {
    return <div>Please log in to view profiles.</div>;
  }

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.loading}>Loading profile...</div>
      </div>
    );
  }

  if (error && !profile) {
    return (
      <div style={styles.container}>
        <div style={styles.error}>{error}</div>
        <button onClick={() => navigate('/dashboard')} style={styles.button}>
          Back to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1>{isOwnProfile ? 'My Profile' : `${profileUsername}'s Profile`}</h1>
        <div>
          <button onClick={() => navigate('/dashboard')} style={styles.headerButton}>
            Dashboard
          </button>
          <button onClick={() => navigate('/chat')} style={styles.headerButton}>
            Chat
          </button>
          <button onClick={logout} style={styles.logoutButton}>
            Logout
          </button>
        </div>
      </div>

      {error && <div style={styles.errorMessage}>{error}</div>}
      {success && <div style={styles.successMessage}>{success}</div>}

      <div style={styles.content}>
        <div style={styles.profileCard}>
          <div style={styles.profileHeader}>
            <div style={styles.profilePictureContainer}>
              {profile?.profile_picture ? (
                <img 
                  src={`${PROFILE_SERVICE_URL}${profile.profile_picture}`} 
                  alt="Profile" 
                  style={styles.profilePicture}
                />
              ) : (
                <div style={styles.defaultAvatar}>
                  {profileUsername.charAt(0).toUpperCase()}
                </div>
              )}
            </div>
            <div style={styles.profileInfo}>
              <h2>{profileUsername}</h2>
              <p style={styles.joinDate}>
                Joined: {new Date(profile?.created_at).toLocaleDateString()}
              </p>
              {isOwnProfile && (
                <button 
                  onClick={() => setIsEditing(!isEditing)}
                  style={styles.editButton}
                >
                  {isEditing ? 'Cancel Edit' : 'Edit Profile'}
                </button>
              )}
            </div>
          </div>

          <div style={styles.bioSection}>
            <h3>Bio</h3>
            {isEditing ? (
              <form onSubmit={handleUpdateBio}>
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Tell us about yourself..."
                  style={styles.bioTextarea}
                  maxLength={500}
                />
                <div style={styles.formButtons}>
                  <button type="submit" style={styles.saveButton}>
                    Save Bio
                  </button>
                  <button 
                    type="button" 
                    onClick={() => setIsEditing(false)}
                    style={styles.cancelButton}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <p style={styles.bioText}>
                {profile?.bio || 'No bio available.'}
              </p>
            )}
          </div>

          {isOwnProfile && (
            <div style={styles.imageSection}>
              <h3>Profile Picture</h3>
              <div style={styles.imageUploadContainer}>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageSelect}
                  style={styles.fileInput}
                  id="imageUpload"
                  disabled={uploading}
                />
                <label htmlFor="imageUpload" style={styles.uploadButton}>
                  {uploading ? 'Uploading...' : '📷 Change Profile Picture'}
                </label>
                {tempImageData && (
                  <button 
                    onClick={() => setShowCropModal(true)}
                    style={styles.updateImageButton}
                  >
                    Update Profile Picture
                  </button>
                )}
                <p style={styles.uploadHint}>
                  Upload an image to crop and resize it perfectly for your profile
                </p>
              </div>
            </div>
          )}

          <ImageCropModal
            isOpen={showCropModal}
            onClose={() => {
              setShowCropModal(false);
              setTempImageData(null);
            }}
            onSave={handleImageSave}
            tempImageData={tempImageData}
          />

          {isOwnProfile && (
            <div style={styles.passwordSection}>
              <h3>Change Password</h3>
              <form onSubmit={handleChangePassword}>
                <div style={styles.inputGroup}>
                  <input
                    type="password"
                    placeholder="Current Password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    style={styles.input}
                    required
                  />
                </div>
                <div style={styles.inputGroup}>
                  <input
                    type="password"
                    placeholder="New Password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    style={styles.input}
                    required
                  />
                </div>
                <button type="submit" style={styles.passwordButton}>
                  Change Password
                </button>
              </form>
            </div>
          )}
        </div>

        {!isOwnProfile && (
          <div style={styles.actionsCard}>
            <h3>Actions</h3>
            <button 
              onClick={() => navigate('/chat', { 
                state: { selectedUser: profileUsername, chatMode: 'private' } 
              })}
              style={styles.actionButton}
            >
              💬 Send Message
            </button>
          </div>
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
  headerButton: {
    padding: '10px 20px',
    backgroundColor: '#6c757d',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    marginRight: '10px',
    cursor: 'pointer'
  },
  logoutButton: {
    padding: '10px 20px',
    backgroundColor: '#dc3545',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer'
  },
  content: {
    maxWidth: '800px',
    margin: '0 auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '20px'
  },
  profileCard: {
    backgroundColor: 'white',
    padding: '30px',
    borderRadius: '8px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
  },
  profileHeader: {
    display: 'flex',
    alignItems: 'center',
    marginBottom: '30px'
  },
  profilePictureContainer: {
    marginRight: '30px'
  },
  profilePicture: {
    width: '120px',
    height: '120px',
    borderRadius: '50%',
    objectFit: 'cover',
    border: '4px solid #007bff'
  },
  defaultAvatar: {
    width: '120px',
    height: '120px',
    borderRadius: '50%',
    backgroundColor: '#007bff',
    color: 'white',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '48px',
    fontWeight: 'bold'
  },
  profileInfo: {
    flex: 1
  },
  joinDate: {
    color: '#6c757d',
    marginBottom: '15px'
  },
  editButton: {
    padding: '10px 20px',
    backgroundColor: '#007bff',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer'
  },
  bioSection: {
    marginBottom: '30px'
  },
  bioText: {
    fontSize: '16px',
    lineHeight: '1.6',
    color: '#495057'
  },
  bioTextarea: {
    width: '100%',
    minHeight: '100px',
    padding: '12px',
    border: '1px solid #ced4da',
    borderRadius: '4px',
    fontSize: '14px',
    resize: 'vertical',
    marginBottom: '15px'
  },
  fileInputContainer: {
    marginBottom: '15px'
  },
  fileLabel: {
    display: 'block',
    marginBottom: '10px',
    fontWeight: 'bold'
  },
  fileName: {
    marginLeft: '10px',
    color: '#28a745',
    fontSize: '14px'
  },
  formButtons: {
    display: 'flex',
    gap: '10px'
  },
  saveButton: {
    padding: '10px 20px',
    backgroundColor: '#28a745',
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
  imageSection: {
    marginBottom: '30px',
    borderTop: '1px solid #dee2e6',
    paddingTop: '30px'
  },
  imageUploadContainer: {
    textAlign: 'center',
    padding: '20px',
    border: '2px dashed #dee2e6',
    borderRadius: '8px',
    backgroundColor: '#f8f9fa'
  },
  fileInput: {
    display: 'none'
  },
  uploadButton: {
    display: 'inline-block',
    padding: '12px 24px',
    backgroundColor: '#007bff',
    color: 'white',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '16px',
    fontWeight: 'bold',
    transition: 'background-color 0.2s'
  },
  updateImageButton: {
    display: 'block',
    margin: '15px 0',
    padding: '12px 24px',
    backgroundColor: '#28a745',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '16px',
    fontWeight: 'bold',
    transition: 'background-color 0.2s'
  },
  uploadHint: {
    marginTop: '10px',
    fontSize: '14px',
    color: '#6c757d'
  },
  passwordSection: {
    borderTop: '1px solid #dee2e6',
    paddingTop: '30px'
  },
  inputGroup: {
    marginBottom: '15px'
  },
  input: {
    width: '100%',
    padding: '12px',
    border: '1px solid #ced4da',
    borderRadius: '4px',
    fontSize: '14px'
  },
  passwordButton: {
    padding: '10px 20px',
    backgroundColor: '#ffc107',
    color: 'black',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer'
  },
  actionsCard: {
    backgroundColor: 'white',
    padding: '20px',
    borderRadius: '8px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
  },
  actionButton: {
    width: '100%',
    padding: '15px',
    backgroundColor: '#28a745',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '16px',
    fontWeight: 'bold'
  },
  button: {
    padding: '10px 20px',
    backgroundColor: '#007bff',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer'
  },
  loading: {
    textAlign: 'center',
    padding: '50px',
    fontSize: '18px'
  },
  error: {
    textAlign: 'center',
    color: '#dc3545',
    padding: '20px'
  },
  errorMessage: {
    backgroundColor: '#f8d7da',
    color: '#721c24',
    padding: '10px',
    borderRadius: '4px',
    marginBottom: '20px'
  },
  successMessage: {
    backgroundColor: '#d4edda',
    color: '#155724',
    padding: '10px',
    borderRadius: '4px',
    marginBottom: '20px'
  }
};

export default Profile;
