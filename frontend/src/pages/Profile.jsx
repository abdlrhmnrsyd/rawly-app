import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  User, Settings, Camera, Grid, Heart, MessageSquare, 
  UserPlus, UserMinus, ShieldAlert, Sparkles, X, Edit3, Mail, Trash2, Send, Lock, Plus
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api, { API_BASE_URL } from '../services/api';
import LoadingSpinner from '../components/LoadingSpinner';
import './Profile.css';

// Extract backend host URL
const BACKEND_HOST = API_BASE_URL.replace('/api', '');

// Premium Carousel component for multi-media rendering
const PostMedia = ({ media, defaultUrl, defaultType }) => {
  // Fallback to legacy single file parameters if media array is empty
  const items = media && media.length > 0 ? media : [{ media_url: defaultUrl, media_type: defaultType }];

  return (
    <div className="post-media-list" style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%' }}>
      {items.map((item, idx) => {
        if (!item || !item.media_url) return null;
        const formattedUrl = item.media_url.startsWith('http') ? item.media_url : `${BACKEND_HOST}${item.media_url}`;
        
        return (
          <div key={idx} className="post-media-container" style={{ position: 'relative', overflow: 'hidden', width: '100%', minHeight: '350px' }}>
            <div 
              className="post-media-blur-bg" 
              style={item.media_type === 'image' ? { backgroundImage: `url(${formattedUrl})` } : { background: 'linear-gradient(to bottom, #111, #000)' }}
            />
            {item.media_type === 'image' ? (
              <img 
                src={formattedUrl} 
                className="post-image" 
                alt="Post content" 
                loading="lazy"
                style={{ width: '100%', maxHeight: '80vh', objectFit: 'contain', position: 'relative', zIndex: 2 }}
              />
            ) : (
              <video 
                src={formattedUrl} 
                className="post-video" 
                controls 
                preload="metadata"
                style={{ width: '100%', maxHeight: '80vh', objectFit: 'contain', position: 'relative', zIndex: 2 }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
};

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
  const [editIsPrivate, setEditIsPrivate] = useState(false);

  // Follow Requests states
  const [followRequests, setFollowRequests] = useState([]);
  const [loadingRequests, setLoadingRequests] = useState(false);

  // Albums states
  const [albums, setAlbums] = useState([]);
  const [loadingAlbums, setLoadingAlbums] = useState(false);
  const [createAlbumModalOpen, setCreateAlbumModalOpen] = useState(false);
  const [newAlbumTitle, setNewAlbumTitle] = useState('');
  const [newAlbumDesc, setNewAlbumDesc] = useState('');
  const [newAlbumVisibility, setNewAlbumVisibility] = useState('public');
  const [creatingAlbum, setCreatingAlbum] = useState(false);

  // Selected Album Detail Modal states
  const [selectedAlbum, setSelectedAlbum] = useState(null);
  const [albumPosts, setAlbumPosts] = useState([]);
  const [loadingAlbumPosts, setLoadingAlbumPosts] = useState(false);

  const isOwnProfile = currentUser && currentUser.username === username;

  useEffect(() => {
    fetchProfileData();
    // Close modals on route change
    setSelectedPost(null);
    setSelectedAlbum(null);
  }, [username, currentUser]);

  const fetchProfileData = async () => {
    setLoading(true);
    try {
      const response = await api.get(`/users/profile/${username}`);
      if (response.success && response.data) {
        const profileData = response.data;
        setProfile(profileData);
        // Pre-fill edit inputs if own profile
        setEditUsername(profileData.username);
        setEditEmail(profileData.email);
        setEditBio(profileData.bio || '');
        setEditIsPrivate(profileData.is_private);

        const canViewContent = isOwnProfile || !profileData.is_private || profileData.follow_status === 'accepted';
        if (canViewContent) {
          fetchUserPosts();
          fetchUserAlbums(profileData.id);
        } else {
          setPosts([]);
          setAlbums([]);
        }

        if (isOwnProfile) {
          fetchFollowRequests();
        } else {
          setFollowRequests([]);
        }
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
      const response = await api.get(`/users/profile/${username}/posts?limit=1000`);
      if (response.success && Array.isArray(response.data)) {
        setPosts(response.data);
      }
    } catch (err) {
      console.error('Error fetching user posts:', err);
    } finally {
      setLoadingPosts(false);
    }
  };

  const fetchUserAlbums = async (targetUserID) => {
    const idToFetch = targetUserID || (profile && profile.id);
    if (!idToFetch) return;
    setLoadingAlbums(true);
    try {
      const response = await api.get(`/users/${idToFetch}/albums`);
      if (response.success && Array.isArray(response.data)) {
        setAlbums(response.data);
      }
    } catch (err) {
      console.error('Error fetching user albums:', err);
    } finally {
      setLoadingAlbums(false);
    }
  };

  const fetchFollowRequests = async () => {
    setLoadingRequests(true);
    try {
      const response = await api.get('/users/follow-requests');
      if (response.success && Array.isArray(response.data)) {
        setFollowRequests(response.data);
      }
    } catch (err) {
      console.error('Error fetching follow requests:', err);
    } finally {
      setLoadingRequests(false);
    }
  };

  const handleAcceptRequest = async (followerID) => {
    try {
      const response = await api.post(`/users/follow-requests/${followerID}/accept`);
      if (response.success) {
        setFollowRequests(prev => prev.filter(r => r.user_id !== followerID));
        fetchProfileData(); // refresh profile details (e.g. followers count)
      }
    } catch (err) {
      alert('Failed to accept follow request');
    }
  };

  const handleDeclineRequest = async (followerID) => {
    try {
      const response = await api.post(`/users/follow-requests/${followerID}/decline`);
      if (response.success) {
        setFollowRequests(prev => prev.filter(r => r.user_id !== followerID));
      }
    } catch (err) {
      alert('Failed to decline follow request');
    }
  };

  const handleCreateAlbumSubmit = async (e) => {
    e.preventDefault();
    if (!newAlbumTitle.trim()) return;
    setCreatingAlbum(true);
    try {
      const response = await api.post('/albums', {
        title: newAlbumTitle.trim(),
        description: newAlbumDesc.trim(),
        visibility: newAlbumVisibility
      });
      if (response.success && response.data) {
        setAlbums(prev => [response.data, ...prev]);
        setCreateAlbumModalOpen(false);
        setNewAlbumTitle('');
        setNewAlbumDesc('');
        setNewAlbumVisibility('public');
      }
    } catch (err) {
      alert(err.message || 'Failed to create album');
    } finally {
      setCreatingAlbum(false);
    }
  };

  const handleDeleteAlbum = async (e, albumID) => {
    e.stopPropagation();
    if (!window.confirm("Are you sure you want to delete this album? Your posts won't be deleted, but the album itself will be removed.")) return;
    try {
      const response = await api.delete(`/albums/${albumID}`);
      if (response.success) {
        setAlbums(prev => prev.filter(album => album.id !== albumID));
        if (selectedAlbum && selectedAlbum.id === albumID) {
          setSelectedAlbum(null);
        }
      }
    } catch (err) {
      alert('Failed to delete album');
    }
  };

  const openAlbumDetail = async (album) => {
    setSelectedAlbum(album);
    setLoadingAlbumPosts(true);
    setAlbumPosts([]);
    try {
      const response = await api.get(`/albums/${album.id}/posts`);
      if (response.success && Array.isArray(response.data)) {
        setAlbumPosts(response.data);
      }
    } catch (err) {
      console.error('Error fetching album posts:', err);
    } finally {
      setLoadingAlbumPosts(false);
    }
  };

  const handleFollowToggle = async () => {
    if (!currentUser) {
      navigate('/login');
      return;
    }
    if (!profile) return;

    const isCurrentlyFollowedOrPending = profile.follow_status === 'accepted' || profile.follow_status === 'pending';
    const originalFollowStatus = profile.follow_status;
    const originalFollowersCount = profile.followers_count;

    // Optimistic UI updates
    setProfile(prev => {
      let nextStatus = 'none';
      let nextFollowerCount = prev.followers_count;
      
      if (isCurrentlyFollowedOrPending) {
        nextStatus = 'none';
        if (originalFollowStatus === 'accepted') {
          nextFollowerCount = Math.max(0, prev.followers_count - 1);
        }
      } else {
        nextStatus = prev.is_private ? 'pending' : 'accepted';
        if (!prev.is_private) {
          nextFollowerCount = prev.followers_count + 1;
        }
      }
      
      return {
        ...prev,
        follow_status: nextStatus,
        followers_count: nextFollowerCount
      };
    });

    try {
      const endpoint = `/users/${isCurrentlyFollowedOrPending ? 'unfollow' : 'follow'}/${profile.id}`;
      await api.post(endpoint);
      // Re-fetch profile data to stay in sync with the database
      const response = await api.get(`/users/profile/${username}`);
      if (response.success && response.data) {
        setProfile(response.data);
      }
    } catch (err) {
      console.error('Error toggling follow:', err);
      // Revert if failed
      setProfile(prev => ({
        ...prev,
        follow_status: originalFollowStatus,
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
        bio: editBio.trim(),
        is_private: editIsPrivate
      });

      if (response.success && response.data) {
        const updated = response.data;
        setProfile(prev => ({
          ...prev,
          username: updated.username,
          email: updated.email,
          bio: updated.bio,
          is_private: updated.is_private
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
                <button className="btn btn-secondary" onClick={() => {
                  setEditIsPrivate(profile.is_private);
                  setEditModalOpen(true);
                }}>
                  <Settings size={16} /> Edit Profile
                </button>
              ) : profile.is_banned ? (
                <span className="btn-banned-badge">Account Banned</span>
              ) : profile.follow_status === 'accepted' ? (
                <button className="btn btn-following" onClick={handleFollowToggle}>
                  <UserMinus size={16} /> Following
                </button>
              ) : profile.follow_status === 'pending' ? (
                <button className="btn btn-following" onClick={handleFollowToggle}>
                  <UserMinus size={16} /> Requested
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

      {/* Follow Requests Panel */}
      {isOwnProfile && followRequests.length > 0 && (
        <div className="follow-requests-panel glass fade-in">
          <h4>Follow Requests ({followRequests.length})</h4>
          <div className="requests-list">
            {followRequests.map((req) => (
              <div key={req.id} className="request-item">
                <div className="request-user" onClick={() => navigate(`/profile/${req.username}`)}>
                  {renderCommentAvatar(req.avatar)}
                  <span>@{req.username}</span>
                </div>
                <div className="request-actions">
                  <button className="btn btn-primary btn-sm" onClick={() => handleAcceptRequest(req.user_id)}>
                    Accept
                  </button>
                  <button className="btn btn-secondary btn-sm" onClick={() => handleDeclineRequest(req.user_id)}>
                    Decline
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Conditional Lock Screen or Tabs Content */}
      {!isOwnProfile && profile.is_private && profile.follow_status !== 'accepted' ? (
        <div className="private-profile-lock glass fade-in">
          <Lock size={40} style={{ color: 'hsl(var(--text-muted))', marginBottom: '12px' }} />
          <h3>This Account is Private</h3>
          <p>Follow this account to see their photos and videos.</p>
        </div>
      ) : (
        <>
          {/* Grid Tabs */}
          <div className="profile-tabs-header">
            <button 
              className={`profile-tab ${activeTab === 'posts' ? 'active' : ''}`}
              onClick={() => setActiveTab('posts')}
            >
              <Grid size={16} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
              POSTS
            </button>
            <button 
              className={`profile-tab ${activeTab === 'albums' ? 'active' : ''}`}
              onClick={() => setActiveTab('albums')}
            >
              <Sparkles size={16} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
              ALBUMS
            </button>
          </div>

          {/* Posts Tab Content */}
          {activeTab === 'posts' && (
            loadingPosts ? (
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
            )
          )}

          {/* Albums Tab Content */}
          {activeTab === 'albums' && (
            <div className="albums-container fade-in">
              {isOwnProfile && (
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '20px' }}>
                  <button className="btn btn-primary" onClick={() => setCreateAlbumModalOpen(true)}>
                    <Plus size={16} style={{ marginRight: '6px' }} /> Create New Album
                  </button>
                </div>
              )}

              {loadingAlbums ? (
                <LoadingSpinner />
              ) : albums.length === 0 ? (
                <div className="empty-posts glass">
                  <Sparkles size={40} style={{ color: 'hsl(var(--text-muted))' }} />
                  <h3>No Albums Yet</h3>
                  <p>{isOwnProfile ? 'Create albums to organize your collection!' : 'This user has not created any albums yet.'}</p>
                </div>
              ) : (
                <div className="albums-grid">
                  {albums.map((album) => {
                    let coverUrl = '';
                    if (album.posts && album.posts.length > 0) {
                      const firstPost = album.posts[0];
                      if (firstPost.media && firstPost.media.length > 0) {
                        const mUrl = firstPost.media[0].media_url;
                        coverUrl = mUrl.startsWith('http') ? mUrl : `${BACKEND_HOST}${mUrl}`;
                      } else if (firstPost.media_url) {
                        const mUrl = firstPost.media_url;
                        coverUrl = mUrl.startsWith('http') ? mUrl : `${BACKEND_HOST}${mUrl}`;
                      }
                    }

                    return (
                      <div key={album.id} className="album-card" onClick={() => openAlbumDetail(album)}>
                        <div className="album-cover-wrap">
                          {coverUrl ? (
                            <img src={coverUrl} className="album-cover" alt={album.title} />
                          ) : (
                            <div className="album-cover-fallback">
                              <Sparkles size={32} />
                            </div>
                          )}
                        </div>
                        <div className="album-info-overlay">
                          <div className="album-title-row">
                            <span className="album-title">{album.title}</span>
                            {isOwnProfile && (
                              <button className="btn-text" style={{ padding: 4, color: 'hsl(var(--danger))' }} onClick={(e) => handleDeleteAlbum(e, album.id)}>
                                <Trash2 size={14} />
                              </button>
                            )}
                          </div>
                          {album.description && <p className="album-desc">{album.description}</p>}
                          <div className="album-actions-row">
                            <span>{album.posts ? album.posts.length : 0} posts</span>
                            <span style={{ textTransform: 'capitalize', fontSize: '0.7rem', padding: '2px 6px', background: 'hsla(255, 255, 255, 0.05)', borderRadius: '4px' }}>
                              {album.visibility}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </>
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

              {/* Privacy toggle */}
              <div className="switch-container">
                <div className="switch-label-wrap">
                  <span className="switch-label-title">Private Account</span>
                  <span className="switch-label-desc">Only approved followers can see your posts and albums.</span>
                </div>
                <label className="switch">
                  <input
                    type="checkbox"
                    checked={editIsPrivate}
                    onChange={(e) => setEditIsPrivate(e.target.checked)}
                  />
                  <span className="slider"></span>
                </label>
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

      {/* Create Album Modal */}
      {createAlbumModalOpen && (
        <div className="modal-overlay" onClick={() => setCreateAlbumModalOpen(false)}>
          <div className="modal-content glass" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '440px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <h3 style={{ fontFamily: 'var(--font-secondary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Sparkles style={{ color: 'hsl(var(--primary))' }} /> Create New Album
              </h3>
              <button className="drawer-close" onClick={() => setCreateAlbumModalOpen(false)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCreateAlbumSubmit}>
              <div className="form-group">
                <label className="form-label">Album Title</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Vacation 2026"
                  value={newAlbumTitle}
                  onChange={(e) => setNewAlbumTitle(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Description</label>
                <textarea
                  className="form-input"
                  style={{ minHeight: '80px', resize: 'none', background: 'hsla(220, 20%, 8%, 0.8)' }}
                  placeholder="What is this album about?"
                  value={newAlbumDesc}
                  onChange={(e) => setNewAlbumDesc(e.target.value)}
                  maxLength={200}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Visibility</label>
                <select
                  className="form-input select-input-opt"
                  style={{ background: 'hsla(220, 20%, 8%, 0.8)' }}
                  value={newAlbumVisibility}
                  onChange={(e) => setNewAlbumVisibility(e.target.value)}
                >
                  <option value="public">Public</option>
                  <option value="followers">Followers Only</option>
                </select>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '16px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setCreateAlbumModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={creatingAlbum}>
                  {creatingAlbum ? 'Creating...' : 'Create Album'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Selected Album Detail Modal */}
      {selectedAlbum && (
        <div className="modal-overlay" onClick={() => setSelectedAlbum(null)}>
          <div 
            className="modal-content glass fade-in" 
            onClick={(e) => e.stopPropagation()} 
            style={{ 
              maxWidth: '800px', 
              width: '95%', 
              maxHeight: '80vh', 
              overflowY: 'auto',
              padding: '24px'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid hsla(var(--border-color), 0.5)', paddingBottom: '12px' }}>
              <div>
                <h3 style={{ fontFamily: 'var(--font-secondary)', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                  <Sparkles style={{ color: 'hsl(var(--primary))' }} /> {selectedAlbum.title}
                </h3>
                {selectedAlbum.description && <p style={{ fontSize: '0.88rem', color: 'hsl(var(--text-secondary))', margin: '4px 0 0 0' }}>{selectedAlbum.description}</p>}
              </div>
              <button className="drawer-close" onClick={() => setSelectedAlbum(null)}>
                <X size={18} />
              </button>
            </div>

            {loadingAlbumPosts ? (
              <LoadingSpinner />
            ) : albumPosts.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: 'hsl(var(--text-muted))' }}>
                No posts inside this album.
              </div>
            ) : (
              <div className="posts-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                {albumPosts.map((post) => {
                  const formattedMediaUrl = post.media_url.startsWith('http') ? post.media_url : `${BACKEND_HOST}${post.media_url}`;
                  return (
                    <div 
                      key={post.id} 
                      className="grid-post-item"
                      onClick={() => {
                        setSelectedPost(post);
                        openPostDetail(post);
                      }}
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
            <div className="modal-media-wrap" style={{ position: 'relative', overflow: 'hidden' }}>
              <PostMedia 
                media={selectedPost.media} 
                defaultUrl={selectedPost.media_url} 
                defaultType={selectedPost.media_type} 
              />
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
