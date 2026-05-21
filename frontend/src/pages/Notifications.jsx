import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Bell, Heart, MessageSquare, UserPlus, Check, 
  Compass, X, Trash2, Send
} from 'lucide-react';
import api, { API_BASE_URL } from '../services/api';
import LoadingSpinner from '../components/LoadingSpinner';
import './Notifications.css';

// Extract backend host URL
const BACKEND_HOST = API_BASE_URL.replace('/api', '');

const Notifications = () => {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [markingAll, setMarkingAll] = useState(false);

  // Single post detailed view state (when clicking like/comment notifications)
  const [selectedPost, setSelectedPost] = useState(null);
  const [postComments, setPostComments] = useState([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [newCommentText, setNewCommentText] = useState('');

  useEffect(() => {
    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const response = await api.get('/notifications?page=1&limit=50');
      if (response.success && Array.isArray(response.data)) {
        setNotifications(response.data);
      }
    } catch (err) {
      console.error('Error fetching notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAllRead = async () => {
    if (notifications.filter(n => !n.is_read).length === 0) return;
    setMarkingAll(true);
    try {
      const response = await api.post('/notifications/read');
      if (response.success) {
        setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      }
    } catch (err) {
      console.error('Error marking notifications read:', err);
    } finally {
      setMarkingAll(false);
    }
  };

  // Click on a notification item
  const handleNotificationClick = async (notif) => {
    if (notif.type === 'follow') {
      navigate(`/profile/${notif.actor?.username}`);
    } else if (notif.type === 'like' || notif.type === 'comment') {
      // Load and show the post detail modal
      setLoadingComments(true);
      setSelectedPost({ id: notif.reference_id, loading: true });
      try {
        const postRes = await api.get(`/posts/${notif.reference_id}`);
        if (postRes.success && postRes.data) {
          setSelectedPost(postRes.data);
          
          // Load comments
          const commentsRes = await api.get(`/posts/${notif.reference_id}/comments`);
          if (commentsRes.success) {
            setPostComments(commentsRes.data || []);
          }
        } else {
          alert("This post is no longer available.");
          setSelectedPost(null);
        }
      } catch (err) {
        console.error('Error loading target post details:', err);
        alert("This post has been deleted by its owner or moderated by administration.");
        setSelectedPost(null);
      } finally {
        setLoadingComments(false);
      }
    }
  };

  // Detailed post modal comment form handlers
  const handleAddCommentDetail = async (e) => {
    e.preventDefault();
    if (!newCommentText.trim() || !selectedPost) return;

    const content = newCommentText;
    setNewCommentText('');

    try {
      const response = await api.post(`/posts/${selectedPost.id}/comments`, { content });
      if (response.success && response.data) {
        // Enriched comment
        const currentToken = localStorage.getItem('access_token');
        // Retrieve self context from local Storage or api. For simplicity, fetch from window context or localStorage
        let myUsername = 'me';
        let myAvatar = null;
        try {
          const meRes = await api.get('/users/me');
          if (meRes.success) {
            myUsername = meRes.data.username;
            myAvatar = meRes.data.avatar;
          }
        } catch (meErr) {
          console.error(meErr);
        }

        const newComment = {
          ...response.data,
          user: {
            username: myUsername,
            avatar: myAvatar
          }
        };

        setPostComments(prev => [newComment, ...prev]);
        setSelectedPost(prev => ({ ...prev, comments_count: prev.comments_count + 1 }));
      }
    } catch (err) {
      console.error('Error adding comment:', err);
    }
  };

  const closePostDetail = () => {
    setSelectedPost(null);
    setPostComments([]);
  };

  // Format Helper
  const formatTime = (timeStr) => {
    const date = new Date(timeStr);
    return date.toLocaleDateString(undefined, { 
      month: 'short', 
      day: 'numeric', 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const renderNotifAvatar = (avatarPath) => {
    if (avatarPath) {
      const src = avatarPath.startsWith('http') ? avatarPath : `${BACKEND_HOST}${avatarPath}`;
      return <img src={src} className="actor-avatar" alt="Avatar" onError={(e) => { e.target.src = 'https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y'; }} />;
    }
    return <div className="actor-avatar" style={{ background: 'linear-gradient(135deg, hsl(var(--primary)), hsl(var(--secondary)))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '0.8rem', fontWeight: 'bold' }}>U</div>;
  };

  const renderCommentAvatar = (avatarPath) => {
    if (avatarPath) {
      const src = avatarPath.startsWith('http') ? avatarPath : `${BACKEND_HOST}${avatarPath}`;
      return <img src={src} style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover' }} alt="Avatar" onError={(e) => { e.target.src = 'https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y'; }} />;
    }
    return <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'linear-gradient(135deg, hsl(var(--primary)), hsl(var(--secondary)))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '0.75rem', fontWeight: 'bold' }}>U</div>;
  };

  const getNotificationText = (notif) => {
    switch (notif.type) {
      case 'like':
        return 'liked your post';
      case 'comment':
        return 'commented on your post';
      case 'follow':
        return 'started following you';
      default:
        return 'interacted with your account';
    }
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'like':
        return <Heart size={10} fill="white" color="white" />;
      case 'comment':
        return <MessageSquare size={10} fill="white" color="white" />;
      case 'follow':
        return <UserPlus size={10} color="white" />;
      default:
        return <Bell size={10} color="white" />;
    }
  };

  const hasUnread = notifications.some(n => !n.is_read);

  return (
    <div className="notifications-container fade-in">
      {/* Header */}
      <div className="notifications-header">
        <h2 className="notifications-title">Notifications</h2>
        {hasUnread && (
          <button 
            className="btn btn-secondary" 
            onClick={handleMarkAllRead} 
            disabled={markingAll}
            style={{ padding: '8px 14px', fontSize: '0.85rem' }}
          >
            <Check size={14} style={{ marginRight: '6px' }} /> 
            {markingAll ? 'Marking...' : 'Mark all as read'}
          </button>
        )}
      </div>

      {/* List */}
      {loading ? (
        <LoadingSpinner />
      ) : notifications.length === 0 ? (
        <div className="empty-notifications glass">
          <Bell size={48} style={{ color: 'hsl(var(--text-muted))' }} />
          <h3>All caught up!</h3>
          <p>No new notifications here. We'll alert you when other users interact with your shares.</p>
        </div>
      ) : (
        <div className="notifications-list">
          {notifications.map((notif) => (
            <div 
              key={notif.id} 
              className={`notification-item glass ${notif.is_read ? '' : 'unread'}`}
              onClick={() => handleNotificationClick(notif)}
              style={{ cursor: 'pointer' }}
            >
              <div className="notification-left">
                <div style={{ position: 'relative' }}>
                  {renderNotifAvatar(notif.actor?.avatar)}
                  <div className={`notif-icon-badge ${notif.type}`}>
                    {getNotificationIcon(notif.type)}
                  </div>
                </div>
                
                <div className="notification-content">
                  <div>
                    <span 
                      className="actor-name"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/profile/${notif.actor?.username}`);
                      }}
                    >
                      {notif.actor?.username || 'user'}
                    </span>
                    <span className="notif-desc">{getNotificationText(notif)}</span>
                  </div>
                  
                  <span className="notification-time">{formatTime(notif.created_at)}</span>
                </div>
              </div>

              <div className="notification-right">
                {!notif.is_read && <div className="unread-dot"></div>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Single Post Detail Modal Overlay (when clicking on notifications) */}
      {selectedPost && !selectedPost.loading && (
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
                <img src={selectedPost.media_url.startsWith('http') ? selectedPost.media_url : `${BACKEND_HOST}${selectedPost.media_url}`} style={{ width: '100%', maxHeight: '80vh', objectFit: 'contain' }} alt="Post content" />
              )}
            </div>

            {/* Right side: Author, caption & comments */}
            <div style={{ flex: '1', minWidth: '300px', display: 'flex', flexDirection: 'column', height: '100%', maxHeight: '80vh', background: 'hsl(var(--surface-color))' }}>
              {/* Header */}
              <div style={{ padding: '16px', borderBottom: '1px solid hsl(var(--border-color))', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  {renderCommentAvatar(selectedPost.avatar)}
                  <span style={{ fontWeight: '700', fontSize: '0.95rem' }}>@{selectedPost.username}</span>
                </div>
                <button className="drawer-close" onClick={closePostDetail}>
                  <X size={18} />
                </button>
              </div>

              {/* Scrollable comments list */}
              <div style={{ flex: '1', overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {selectedPost.caption && (
                  <div style={{ display: 'flex', gap: '10px', borderBottom: '1px solid hsla(var(--border-color), 0.5)', paddingBottom: '14px', marginBottom: '4px' }}>
                    {renderCommentAvatar(selectedPost.avatar)}
                    <div>
                      <span style={{ fontWeight: '700', marginRight: '6px', fontSize: '0.9rem' }}>@{selectedPost.username}</span>
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

export default Notifications;
