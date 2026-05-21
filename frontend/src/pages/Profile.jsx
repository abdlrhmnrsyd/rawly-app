import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  User, Settings, Camera, Grid, Heart, MessageSquare, 
  UserPlus, UserMinus, ShieldAlert, Sparkles, X, Edit3, Mail, Trash2, Send
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api, { API_BASE_URL } from '../services/api';
import LoadingSpinner from '../components/LoadingSpinner';
import './Profile.css';

// Extract backend host URL
const BACKEND_HOST = API_BASE_URL.replace('/api', '');

const Profile = () => {
  const { username } = useParams();
  const navigate = useNavigate();
  const { user: currentUser, updateProfileState } = useAuth();
  
  const [profile, setProfile] = useState(null);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [activeTab, setActiveTab] = useState('posts');
  
  // Edit Profile form state
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editUsername, setEditUsername] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editError, setEditError] = useState('');
  const [editingProfile, setEditingProfile] = useState(false);

  // Avatar upload state
  const avatarInputRef = useRef(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  // Detailed post modal state
  const [selectedPost, setSelectedPost] = useState(null);
  const [postComments, setPostComments] = useState([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [newCommentText, setNewCommentText] = useState('');

  const isOwnProfile = currentUser && currentUser.username === username;

  useEffect(() => {
    fetchProfileData();
    fetchUserPosts();
    // Close modal on route change
    setSelectedPost(null);
  }, [username]);

  const fetchProfileData = async () => {
    setLoading(true);
    try {
      const response = await api.get(`/users/profile/${username}`);
      if (response.success && response.data) {
        setProfile(response.data);
        // Pre-fill edit inputs if own profile
        setEditUsername(response.data.username);
        setEditEmail(response.data.email);
        setEditBio(response.data.bio || '');
      }
    } catch (err) {
      console.error('Error fetching profile:', err);
      setProfile(null);
    } finally {
      setLoading(false);
    }
  };

  const fetchUserPosts = async () => {
    setLoadingPosts(true);
    try {
      const response = await api.get(`/users/profile/${username}/posts`);
      if (response.success && Array.isArray(response.data)) {
        setPosts(response.data);
      }
    } catch (err) {
      console.error('Error fetching user posts:', err);
    } finally {
      setLoadingPosts(false);
    }
  };

  const handleFollowToggle = async () => {
    if (!currentUser) {
      navigate('/login');
      return;
    }
    if (!profile) return;

    const originalFollowingState = profile.is_following;
    const originalFollowersCount = profile.followers_count;

    // Optimistic UI updates
    setProfile(prev => ({
      ...prev,
      is_following: !originalFollowingState,
      followers_count: originalFollowingState ? originalFollowersCount - 1 : originalFollowersCount + 1
    }));

    try {
      const endpoint = `/users/${originalFollowingState ? 'unfollow' : 'follow'}/${profile.id}`;
      await api.post(endpoint);
    } catch (err) {
      console.error('Error toggling follow:', err);
      // Revert if failed
      setProfile(prev => ({
        ...prev,
        is_following: originalFollowingState,
        followers_count: originalFollowersCount
      }));
    }
  };

  // Avatar upload trigger
  const handleAvatarClick = () => {
    if (isOwnProfile && avatarInputRef.current) {
      avatarInputRef.current.click();
    }
  };

  const handleAvatarChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please upload an image file for your avatar.');
      return;
    }

    setUploadingAvatar(true);
    const formData = new FormData();
    formData.append('avatar', file);

    try {
      const response = await api.post('/users/avatar', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      if (response.success && response.data) {
        const avatarUrl = response.data.avatar_url;
        setProfile(prev => ({ ...prev, avatar: avatarUrl }));
        // Sync context state
        updateProfileState({ avatar: avatarUrl });
      }
    } catch (err) {
      alert(err.message || 'Failed to upload avatar.');
    } finally {
      setUploadingAvatar(false);
    }
  };

  // Edit profile form submit
  const handleEditProfileSubmit = async (e) => {
    e.preventDefault();
    setEditError('');
    setEditingProfile(true);

    if (!editUsername.trim() || !editEmail.trim()) {
      setEditError('Username and email are required.');
      setEditingProfile(false);
      return;
    }

    try {
      const response = await api.put('/users/profile', {
        username: editUsername.trim(),
        email: editEmail.trim(),
        bio: editBio.trim()
      });

      if (response.success && response.data) {
        const updated = response.data;
        setProfile(prev => ({
          ...prev,
          username: updated.username,
          email: updated.email,
          bio: updated.bio
        }));

        // Sync context
        updateProfileState({
          username: updated.username,
          email: updated.email,
          bio: updated.bio
        });

        setEditModalOpen(false);
        
        // If username was changed, redirect to new profile path
        if (updated.username !== username) {
          navigate(`/profile/${updated.username}`);
        }
      }
    } catch (err) {
      setEditError(err.message || 'Failed to update profile.');
    } finally {
      setEditingProfile(false);
    }
  };

  // Post detail modal handlers
  const openPostDetail = async (post) => {
    setSelectedPost(post);
    setLoadingComments(true);
    setPostComments([]);
    try {
      const response = await api.get(`/posts/${post.id}/comments`);
      if (response.success) {
        setPostComments(response.data || []);
      }
    } catch (err) {
      console.error('Error fetching comments:', err);
    } finally {
      setLoadingComments(false);
    }
  };

  const closePostDetail = () => {
    setSelectedPost(null);
    setPostComments([]);
  };

  const handleAddCommentDetail = async (e) => {
    e.preventDefault();
    if (!newCommentText.trim() || !selectedPost) return;

    const content = newCommentText;
    setNewCommentText('');

    try {
      const response = await api.post(`/posts/${selectedPost.id}/comments`, { content });
      if (response.success && response.data) {
        const newComment = {
          ...response.data,
          user: {
            id: currentUser.id,
            username: currentUser.username,
            avatar: currentUser.avatar,
            role: currentUser.role
          }
        };

        setPostComments(prev => [newComment, ...prev]);

        // Sync post list comment counter
        setPosts(prevPosts =>
          prevPosts.map(p => {
            if (p.id === selectedPost.id) {
              return { ...p, comments_count: p.comments_count + 1 };
            }
            return p;
          })
        );

        // Update selected post state inside modal
        setSelectedPost(prev => ({ ...prev, comments_count: prev.comments_count + 1 }));
      }
    } catch (err) {
      console.error('Error adding comment:', err);
    }
  };

  const handleDeletePostDetail = async (postId) => {
    if (!window.confirm("Are you sure you want to delete this post?")) return;

    try {
      const response = await api.delete(`/posts/${postId}`);
      if (response.success) {
        setPosts(prev => prev.filter(post => post.id !== postId));
        closePostDetail();
      }
    } catch (err) {
      console.error('Error deleting post:', err);
    }
  };

  // Avatar renderer helper
  const renderAvatarLarge = (avatarPath) => {
    if (avatarPath) {
      const src = avatarPath.startsWith('http') ? avatarPath : `${BACKEND_HOST}${avatarPath}`;
      return <img src={src} className="profile-avatar-large" alt="Profile" onError={(e) => { e.target.src = 'https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y'; }} />;
    }
    return (
      <div 
        className="profile-avatar-large" 
        style={{ 
          background: 'linear-gradient(135deg, hsl(var(--primary)), hsl(var(--secondary)))', 
          display: 'flex', 
          flexDirection: 'column',
          alignItems: 'center', 
          justifyContent: 'center', 
          color: '#fff', 
          fontSize: '3rem', 
          fontWeight: 'bold' 
        }}
      >
        {username ? username.charAt(0).toUpperCase() : 'U'}
      </div>
    );
  };

  const renderCommentAvatar = (avatarPath) => {
    if (avatarPath) {
      const src = avatarPath.startsWith('http') ? avatarPath : `${BACKEND_HOST}${avatarPath}`;
      return <img src={src} style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover' }} alt="avatar" onError={(e) => { e.target.src = 'https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y'; }} />;
    }
    return <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'linear-gradient(135deg, hsl(var(--primary)), hsl(var(--secondary)))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '0.75rem', fontWeight: 'bold' }}>U</div>;
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  if (!profile) {
    return (
      <div style={{ padding: '80px 20px', textAlign: 'center', color: 'hsl(var(--text-secondary))' }}>
        <ShieldAlert size={48} style={{ color: 'hsl(var(--danger))', marginBottom: '16px' }} />
        <h2>Profile Not Found</h2>
        <p>The user you are trying to view does not exist or has been deleted.</p>
        <button className="btn btn-secondary" style={{ marginTop: '20px' }} onClick={() => navigate('/')}>
          Return to Home Feed
        </button>
      </div>
    );
  }

  return (
    <div className="profile-container fade-in">
      {/* Profile Header */}
      <div className="profile-header">
        <div className="avatar-container" onClick={handleAvatarClick} style={{ cursor: isOwnProfile ? 'pointer' : 'default' }}>
          {renderAvatarLarge(profile.avatar)}
          
          {isOwnProfile && (
            <div className="avatar-edit-overlay">
              {uploadingAvatar ? (
                <div className="spinner" style={{ width: '18px', height: '18px' }}></div>
              ) : (
                <>
                  <Camera size={18} />
                  <span>Update Photo</span>
                </>
              )}
            </div>
          )}

          <input
            type="file"
            ref={avatarInputRef}
            style={{ display: 'none' }}
            onChange={handleAvatarChange}
            accept="image/*"
          />
        </div>

        <div className="profile-info">
          <div className="profile-username-row">
            <span className="profile-username">@{profile.username}</span>
            
            <div className="profile-actions">
              {isOwnProfile ? (
                <button className="btn btn-secondary" onClick={() => setEditModalOpen(true)}>
                  <Settings size={16} /> Edit Profile
                </button>
              ) : profile.is_banned ? (
                <span className="btn-banned-badge">Account Banned</span>
              ) : profile.is_following ? (
                <button className="btn btn-following" onClick={handleFollowToggle}>
                  <UserMinus size={16} /> Following
                </button>
              ) : (
                <button className="btn btn-follow" onClick={handleFollowToggle}>
                  <UserPlus size={16} /> Follow
                </button>
              )}
            </div>
          </div>

          <div className="profile-stats">
            <div className="stat-item">
              <span className="stat-number">{profile.posts_count}</span>
              <span className="stat-label">posts</span>
            </div>
            <div className="stat-item">
              <span className="stat-number">{profile.followers_count}</span>
              <span className="stat-label">followers</span>
            </div>
            <div className="stat-item">
              <span className="stat-number">{profile.following_count}</span>
              <span className="stat-label">following</span>
            </div>
          </div>

          {profile.bio && (
            <p className="profile-bio glass" style={{ padding: '12px 16px', borderRadius: 'var(--radius-md)', border: '1px solid rgba(var(--border-glass))' }}>
              {profile.bio}
            </p>
          )}
        </div>
      </div>

      {/* Grid Tabs */}
      <div className="profile-tabs-header">
        <button 
          className={`profile-tab ${activeTab === 'posts' ? 'active' : ''}`}
          onClick={() => setActiveTab('posts')}
        >
          <Grid size={16} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
          POSTS
        </button>
      </div>

      {/* Posts Section */}
      {loadingPosts ? (
        <LoadingSpinner />
      ) : posts.length === 0 ? (
        <div className="empty-posts glass">
          <Grid size={40} style={{ color: 'hsl(var(--text-muted))' }} />
          <h3>No Posts Yet</h3>
          <p>{isOwnProfile ? 'Share your first spectacular image or video!' : 'This user hasn\'t posted anything yet.'}</p>
        </div>
      ) : (
        <div className="posts-grid">
          {posts.map((post) => {
            const formattedMediaUrl = post.media_url.startsWith('http') ? post.media_url : `${BACKEND_HOST}${post.media_url}`;
            return (
              <div 
                key={post.id} 
                className="grid-post-item"
                onClick={() => openPostDetail(post)}
              >
                {post.media_type === 'video' ? (
                  <>
                    <video src={formattedMediaUrl} className="grid-media" preload="metadata" muted />
                    <div className="grid-video-icon">
                      <Camera size={14} />
                    </div>
                  </>
                ) : (
                  <img src={formattedMediaUrl} className="grid-media" alt="Post" loading="lazy" />
                )}

                <div className="grid-overlay">
                  <span className="overlay-stat"><Heart size={16} fill="white" /> {post.likes_count}</span>
                  <span className="overlay-stat"><MessageSquare size={16} fill="white" /> {post.comments_count}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Edit Profile Modal */}
      {editModalOpen && (
        <div className="modal-overlay" onClick={() => setEditModalOpen(false)}>
          <div className="modal-content glass" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '460px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <h3 style={{ fontFamily: 'var(--font-secondary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Edit3 style={{ color: 'hsl(var(--primary))' }} /> Edit Profile Info
              </h3>
              <button className="drawer-close" onClick={() => setEditModalOpen(false)}>
                <X size={18} />
              </button>
            </div>

            {editError && (
              <div className="auth-error">
                <ShieldAlert size={18} />
                <span>{editError}</span>
              </div>
            )}

            <form onSubmit={handleEditProfileSubmit}>
              <div className="form-group">
                <label className="form-label">Username</label>
                <div style={{ position: 'relative' }}>
                  <User size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--text-muted))' }} />
                  <input
                    type="text"
                    className="form-input"
                    value={editUsername}
                    onChange={(e) => setEditUsername(e.target.value)}
                    style={{ paddingLeft: '38px' }}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Email Address</label>
                <div style={{ position: 'relative' }}>
                  <Mail size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--text-muted))' }} />
                  <input
                    type="email"
                    className="form-input"
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    style={{ paddingLeft: '38px' }}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Biography</label>
                <textarea
                  className="form-input"
                  style={{ minHeight: '80px', resize: 'none', background: 'hsla(220, 20%, 8%, 0.8)' }}
                  placeholder="Tell us about yourself..."
                  value={editBio}
                  onChange={(e) => setEditBio(e.target.value)}
                  maxLength={150}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '16px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setEditModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={editingProfile}>
                  {editingProfile ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Detailed Post Modal */}
      {selectedPost && (
        <div className="modal-overlay" onClick={closePostDetail}>
          <div 
            className="modal-content glass fade-in" 
            onClick={(e) => e.stopPropagation()} 
            style={{ 
              maxWidth: '900px', 
              width: '95%', 
              padding: 0, 
              display: 'flex', 
              flexDirection: 'row', 
              flexWrap: 'wrap',
              maxHeight: '85vh',
              overflow: 'hidden'
            }}
          >
            {/* Left side: Media */}
            <div style={{ flex: '1.2', minWidth: '300px', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', minHeight: '350px' }}>
              {selectedPost.media_type === 'video' ? (
                <video src={selectedPost.media_url.startsWith('http') ? selectedPost.media_url : `${BACKEND_HOST}${selectedPost.media_url}`} style={{ width: '100%', maxHeight: '80vh', objectFit: 'contain' }} controls autoPlay />
              ) : (
                <img src={selectedPost.media_url.startsWith('http') ? selectedPost.media_url : `${BACKEND_HOST}${selectedPost.media_url}`} style={{ width: '100%', maxHeight: '80vh', objectFit: 'contain' }} alt="Post detail" />
              )}
            </div>

            {/* Right side: Author, caption & comments */}
            <div style={{ flex: '1', minWidth: '300px', display: 'flex', flexDirection: 'column', height: '100%', maxHeight: '80vh', background: 'hsl(var(--surface-color))' }}>
              {/* Header */}
              <div style={{ padding: '16px', borderBottom: '1px solid hsl(var(--border-color))', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  {renderCommentAvatar(profile.avatar)}
                  <span style={{ fontWeight: '700', fontSize: '0.95rem' }}>@{profile.username}</span>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {(isOwnProfile || (currentUser && currentUser.role === 'admin')) && (
                    <button 
                      className="btn-text" 
                      style={{ color: 'hsl(var(--danger))', padding: '4px' }}
                      onClick={() => handleDeletePostDetail(selectedPost.id)}
                    >
                      <Trash2 size={18} />
                    </button>
                  )}
                  <button className="drawer-close" onClick={closePostDetail}>
                    <X size={18} />
                  </button>
                </div>
              </div>

              {/* Scrollable comments list */}
              <div style={{ flex: '1', overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {selectedPost.caption && (
                  <div style={{ display: 'flex', gap: '10px', borderBottom: '1px solid hsla(var(--border-color), 0.5)', paddingBottom: '14px', marginBottom: '4px' }}>
                    {renderCommentAvatar(profile.avatar)}
                    <div>
                      <span style={{ fontWeight: '700', marginRight: '6px', fontSize: '0.9rem' }}>@{profile.username}</span>
                      <span style={{ fontSize: '0.9rem', color: 'hsl(var(--text-primary))', lineHeight: '1.4', whiteSpace: 'pre-wrap' }}>{selectedPost.caption}</span>
                    </div>
                  </div>
                )}

                {loadingComments ? (
                  <LoadingSpinner />
                ) : postComments.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px 0', color: 'hsl(var(--text-muted))', fontSize: '0.85rem' }}>
                    No comments yet. Write the first comment!
                  </div>
                ) : (
                  postComments.map((comment) => (
                    <div key={comment.id} style={{ display: 'flex', gap: '10px', fontSize: '0.88rem' }}>
                      {renderCommentAvatar(comment.user?.avatar)}
                      <div style={{ flex: 1, background: 'hsla(255, 255, 255, 0.02)', border: '1px solid hsla(var(--border-color), 0.4)', padding: '8px 10px', borderRadius: 'var(--radius-md)' }}>
                        <div>
                          <span style={{ fontWeight: '700', marginRight: '6px' }}>@{comment.user?.username || 'user'}</span>
                          <span style={{ color: 'hsl(var(--text-secondary))' }}>{comment.content}</span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Form */}
              <div style={{ padding: '16px', borderTop: '1px solid hsl(var(--border-color))', background: 'hsl(var(--bg-color))' }}>
                <form onSubmit={handleAddCommentDetail} style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    className="comment-input"
                    placeholder="Add a comment..."
                    value={newCommentText}
                    onChange={(e) => setNewCommentText(e.target.value)}
                    required
                  />
                  <button type="submit" className="btn btn-primary" style={{ padding: '8px 12px' }}>
                    <Send size={15} />
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Profile;
