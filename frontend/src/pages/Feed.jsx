import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Heart, MessageSquare, Trash2, ShieldAlert, Image, Film, 
  Send, X, MoreVertical, Flag, UploadCloud, ChevronRight, Compass
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api, { API_BASE_URL } from '../services/api';
import LoadingSpinner from '../components/LoadingSpinner';
import './Feed.css';

// Extract the host URL (e.g., http://localhost:8080) from API_BASE_URL
const BACKEND_HOST = API_BASE_URL.replace('/api', '');

const Feed = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  // Feed posts state
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [fetchingMore, setFetchingMore] = useState(false);

  // Create post states
  const [caption, setCaption] = useState('');
  const [mediaFile, setMediaFile] = useState(null);
  const [mediaPreview, setMediaPreview] = useState('');
  const [mediaType, setMediaType] = useState(''); // 'image' or 'video'
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef(null);

  // Comments drawer states
  const [activePostForComments, setActivePostForComments] = useState(null);
  const [comments, setComments] = useState([]);
  const [newCommentText, setNewCommentText] = useState('');
  const [loadingComments, setLoadingComments] = useState(false);

  // Dropdown menu state
  const [activeMenuId, setActiveMenuId] = useState(null);

  // Report modal states
  const [activePostForReport, setActivePostForReport] = useState(null);
  const [reportReason, setReportReason] = useState('');
  const [reporting, setReporting] = useState(false);

  // Fetch initial posts feed
  useEffect(() => {
    fetchFeed(1, true);
  }, []);

  const fetchFeed = async (pageNum, isInitial = false) => {
    if (isInitial) setLoading(true);
    else setFetchingMore(true);

    try {
      const response = await api.get(`/posts?page=${pageNum}&limit=10`);
      if (response.success && Array.isArray(response.data)) {
        if (isInitial) {
          setPosts(response.data);
        } else {
          setPosts((prev) => {
            // Filter duplicates
            const newPosts = response.data.filter(
              (np) => !prev.some((p) => p.id === np.id)
            );
            return [...prev, ...newPosts];
          });
        }
        
        // If we got fewer items than the limit, there are no more posts
        if (response.data.length < 10) {
          setHasMore(false);
        } else {
          setHasMore(true);
        }
      }
    } catch (err) {
      console.error('Error fetching feed:', err);
    } finally {
      setLoading(false);
      setFetchingMore(false);
    }
  };

  const loadMorePosts = () => {
    if (!fetchingMore && hasMore) {
      const nextPage = page + 1;
      setPage(nextPage);
      fetchFeed(nextPage, false);
    }
  };

  // Like / Unlike action
  const handleLike = async (postId, likedByMe) => {
    // Optimistic UI updates
    setPosts(prevPosts => 
      prevPosts.map(post => {
        if (post.id === postId) {
          return {
            ...post,
            liked_by_me: !likedByMe,
            likes_count: likedByMe ? post.likes_count - 1 : post.likes_count + 1
          };
        }
        return post;
      })
    );

    try {
      const endpoint = `/posts/${postId}/${likedByMe ? 'unlike' : 'like'}`;
      await api.post(endpoint);
    } catch (err) {
      console.error('Error toggling like:', err);
      // Revert state if failed
      setPosts(prevPosts => 
        prevPosts.map(post => {
          if (post.id === postId) {
            return {
              ...post,
              liked_by_me: likedByMe,
              likes_count: likedByMe ? post.likes_count + 1 : post.likes_count - 1
            };
          }
          return post;
        })
      );
    }
  };

  // Open comments list drawer
  const openCommentsDrawer = async (post) => {
    setActivePostForComments(post);
    setLoadingComments(true);
    setComments([]);
    try {
      const response = await api.get(`/posts/${post.id}/comments`);
      if (response.success) {
        setComments(response.data || []);
      }
    } catch (err) {
      console.error('Error loading comments:', err);
    } finally {
      setLoadingComments(false);
    }
  };

  const closeCommentsDrawer = () => {
    setActivePostForComments(null);
    setComments([]);
  };

  // Add Comment
  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!newCommentText.trim() || !activePostForComments) return;

    const commentContent = newCommentText;
    setNewCommentText('');

    try {
      const response = await api.post(`/posts/${activePostForComments.id}/comments`, {
        content: commentContent
      });

      if (response.success && response.data) {
        // Enriched comment item
        const newComment = {
          ...response.data,
          user: {
            id: user.id,
            username: user.username,
            avatar: user.avatar,
            role: user.role
          }
        };
        setComments(prev => [newComment, ...prev]);

        // Increment comments counter on target post
        setPosts(prevPosts =>
          prevPosts.map(p => {
            if (p.id === activePostForComments.id) {
              return { ...p, comments_count: p.comments_count + 1 };
            }
            return p;
          })
        );
      }
    } catch (err) {
      console.error('Error creating comment:', err);
    }
  };

  // Delete Post
  const handleDeletePost = async (postId) => {
    if (!window.confirm("Are you sure you want to delete this post?")) return;

    try {
      const response = await api.delete(`/posts/${postId}`);
      if (response.success) {
        setPosts(prev => prev.filter(post => post.id !== postId));
        setActiveMenuId(null);
      }
    } catch (err) {
      console.error('Error deleting post:', err);
    }
  };

  // Report Post
  const handleReportPost = async (e) => {
    e.preventDefault();
    if (!reportReason.trim() || !activePostForReport) return;
    setReporting(true);

    try {
      const response = await api.post(`/posts/${activePostForReport.id}/report`, {
        reason: reportReason
      });

      if (response.success) {
        alert("Thank you for your report. The administrative moderation team will review it.");
        setActivePostForReport(null);
        setReportReason('');
      }
    } catch (err) {
      console.error('Error reporting post:', err);
    } finally {
      setReporting(false);
    }
  };

  // File Upload Handlers
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    processSelectedFile(file);
  };

  const processSelectedFile = (file) => {
    if (!file) return;

    const fileType = file.type.split('/')[0];
    if (fileType !== 'image' && fileType !== 'video') {
      alert("Unsupported file format! Please upload an image or video.");
      return;
    }

    setMediaFile(file);
    setMediaType(fileType);
    
    // Create preview URL
    const previewUrl = URL.createObjectURL(file);
    setMediaPreview(previewUrl);
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processSelectedFile(e.dataTransfer.files[0]);
    }
  };

  const removeSelectedMedia = () => {
    setMediaFile(null);
    setMediaPreview('');
    setMediaType('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Submit Post
  const handleCreatePost = async (e) => {
    e.preventDefault();
    if (!mediaFile) {
      alert("Please select or drop an image/video first!");
      return;
    }

    setUploading(true);
    const formData = new FormData();
    formData.append('caption', caption);
    formData.append('media', mediaFile);

    try {
      const response = await api.post('/posts', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      if (response.success && response.data) {
        // Build the new post to insert into the top of the feed immediately
        const createdPost = {
          ...response.data,
          username: user.username,
          avatar: user.avatar,
          likes_count: 0,
          comments_count: 0,
          liked_by_me: false
        };

        setPosts(prev => [createdPost, ...prev]);
        
        // Reset form state
        setCaption('');
        removeSelectedMedia();
      }
    } catch (err) {
      alert(err.message || "Failed to create post. Media size limit could be exceeded.");
    } finally {
      setUploading(false);
    }
  };

  // Helper formatting for timestamps
  const formatTime = (timeStr) => {
    const date = new Date(timeStr);
    return date.toLocaleDateString(undefined, { 
      month: 'short', 
      day: 'numeric', 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  // Build profile avatar element
  const renderAvatar = (avatarPath) => {
    if (avatarPath) {
      const src = avatarPath.startsWith('http') ? avatarPath : `${BACKEND_HOST}${avatarPath}`;
      return <img src={src} className="user-avatar-sm" alt="Avatar" onError={(e) => { e.target.src = 'https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y'; }} />;
    }
    return <div className="user-avatar-sm" style={{ background: 'linear-gradient(135deg, hsl(var(--primary)), hsl(var(--secondary)))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '0.8rem', fontWeight: 'bold' }}>U</div>;
  };

  return (
    <div className="feed-container fade-in">
      {/* Create Post Section */}
      <div className="create-post-box glass">
        <div className="create-post-header">
          {renderAvatar(user?.avatar)}
          <textarea
            className="create-post-textarea"
            placeholder={`What's on your mind, ${user?.username || 'user'}?`}
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
          />
        </div>

        {mediaPreview ? (
          <div className="preview-container">
            {mediaType === 'image' ? (
              <img src={mediaPreview} className="media-preview" alt="Preview" />
            ) : (
              <video src={mediaPreview} className="media-preview" controls />
            )}
            <button className="remove-media-btn" onClick={removeSelectedMedia}>
              <X size={18} />
            </button>
          </div>
        ) : (
          <div 
            className={`upload-dropzone ${dragActive ? 'drag-active' : ''}`}
            onDragEnter={handleDrag}
            onDragOver={handleDrag}
            onDragLeave={handleDrag}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <UploadCloud size={32} style={{ color: 'hsl(var(--primary))' }} />
            <p style={{ fontWeight: '600', fontSize: '0.9rem' }}>Drag & Drop file or Click to Browse</p>
            <p style={{ fontSize: '0.75rem', color: 'hsl(var(--text-muted))' }}>Supports Image or Video (Max 50MB)</p>
            <input
              type="file"
              ref={fileInputRef}
              style={{ display: 'none' }}
              onChange={handleFileChange}
              accept="image/*,video/*"
            />
          </div>
        )}

        <div className="create-post-footer">
          <div className="media-upload-options">
            <span className="icon-btn-opt" onClick={() => { fileInputRef.current?.click(); }}>
              <Image size={18} /> Image
            </span>
            <span className="icon-btn-opt" onClick={() => { fileInputRef.current?.click(); }}>
              <Film size={18} /> Video
            </span>
          </div>

          <button 
            className="btn btn-primary" 
            onClick={handleCreatePost} 
            disabled={uploading || !mediaFile}
          >
            {uploading ? (
              <div className="spinner" style={{ width: '20px', height: '20px' }}></div>
            ) : (
              <>
                Share <Send size={15} />
              </>
            )}
          </button>
        </div>
      </div>

      {/* Posts Feed */}
      {loading ? (
        <LoadingSpinner />
      ) : posts.length === 0 ? (
        <div className="empty-feed glass">
          <Compass size={48} style={{ color: 'hsl(var(--text-muted))' }} />
          <h3>No Posts Yet</h3>
          <p>Be the first to share a spectacular photo or video with the world!</p>
        </div>
      ) : (
        <div className="posts-list">
          {posts.map((post) => {
            const isPostOwner = user && post.user_id === user.id;
            const isAdmin = user && user.role === 'admin';
            const showDropdown = activeMenuId === post.id;
            const formattedMediaUrl = post.media_url.startsWith('http') ? post.media_url : `${BACKEND_HOST}${post.media_url}`;

            return (
              <div key={post.id} className="post-card glass">
                {/* Post Header */}
                <div className="post-header">
                  <div className="post-author" onClick={() => navigate(`/profile/${post.username}`)}>
                    {renderAvatar(post.avatar)}
                    <div className="author-info">
                      <span className="author-username">{post.username}</span>
                      <span className="post-time">{formatTime(post.created_at)}</span>
                    </div>
                  </div>

                  <div className="post-actions-menu">
                    <button 
                      className="menu-trigger" 
                      onClick={() => setActiveMenuId(showDropdown ? null : post.id)}
                    >
                      <MoreVertical size={18} />
                    </button>

                    {showDropdown && (
                      <div className="dropdown-menu glass fade-in">
                        {(isPostOwner || isAdmin) && (
                          <button 
                            className="dropdown-item danger"
                            onClick={() => handleDeletePost(post.id)}
                          >
                            <Trash2 size={14} /> Delete
                          </button>
                        )}
                        {!isPostOwner && (
                          <button 
                            className="dropdown-item"
                            onClick={() => {
                              setActivePostForReport(post);
                              setActiveMenuId(null);
                            }}
                          >
                            <Flag size={14} /> Report
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Caption */}
                {post.caption && (
                  <p className="post-caption">{post.caption}</p>
                )}

                {/* Post Media */}
                <div className="post-media-container">
                  {post.media_type === 'image' ? (
                    <img 
                      src={formattedMediaUrl} 
                      className="post-image" 
                      alt="Post content" 
                      loading="lazy"
                    />
                  ) : (
                    <video 
                      src={formattedMediaUrl} 
                      className="post-video" 
                      controls 
                      preload="metadata"
                    />
                  )}
                </div>

                {/* Actions */}
                <div className="post-actions-bar">
                  <button 
                    className={`action-btn ${post.liked_by_me ? 'liked' : ''}`}
                    onClick={() => handleLike(post.id, post.liked_by_me)}
                  >
                    <Heart size={20} />
                    <span>{post.likes_count}</span>
                  </button>

                  <button 
                    className="action-btn comment"
                    onClick={() => openCommentsDrawer(post)}
                  >
                    <MessageSquare size={20} />
                    <span>{post.comments_count}</span>
                  </button>
                </div>
              </div>
            );
          })}

          {/* Load More Button */}
          {hasMore && (
            <div className="pagination-loader">
              <button 
                className="btn btn-secondary" 
                onClick={loadMorePosts}
                disabled={fetchingMore}
              >
                {fetchingMore ? (
                  <div className="spinner" style={{ width: '20px', height: '20px' }}></div>
                ) : (
                  <>
                    Load More <ChevronRight size={18} />
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Drawer for Comments */}
      {activePostForComments && (
        <div className="drawer-backdrop" onClick={closeCommentsDrawer}>
          <div className="drawer-content glass" onClick={(e) => e.stopPropagation()}>
            <div className="drawer-header">
              <span className="drawer-title">Comments</span>
              <button className="drawer-close" onClick={closeCommentsDrawer}>
                <X size={20} />
              </button>
            </div>

            <div className="comments-list">
              {loadingComments ? (
                <LoadingSpinner />
              ) : comments.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 0', color: 'hsl(var(--text-muted))' }}>
                  No comments yet. Write the first comment!
                </div>
              ) : (
                comments.map((comment) => {
                  const avatar = comment.user?.avatar;
                  return (
                    <div key={comment.id} className="comment-item">
                      {renderAvatar(avatar)}
                      <div className="comment-bubble">
                        <div className="comment-author-row">
                          <span className="comment-author">{comment.user?.username || 'user'}</span>
                          <span className="comment-time">{formatTime(comment.created_at)}</span>
                        </div>
                        <p className="comment-body">{comment.content}</p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="drawer-footer">
              <form onSubmit={handleAddComment} className="comment-form">
                <input
                  type="text"
                  className="comment-input"
                  placeholder="Add a comment..."
                  value={newCommentText}
                  onChange={(e) => setNewCommentText(e.target.value)}
                  maxLength={500}
                  required
                />
                <button type="submit" className="btn btn-primary" style={{ padding: '10px 14px' }}>
                  <Send size={16} />
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Report Modal */}
      {activePostForReport && (
        <div className="modal-overlay" onClick={() => setActivePostForReport(null)}>
          <div className="modal-content glass" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ fontFamily: 'var(--font-secondary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ShieldAlert style={{ color: 'hsl(var(--accent))' }} /> Report Post
            </h3>
            <p style={{ fontSize: '0.9rem', color: 'hsl(var(--text-secondary))' }}>
              Help us understand what is wrong with this post. Your report is anonymous.
            </p>
            
            <form onSubmit={handleReportPost}>
              <div className="form-group">
                <label className="form-label">Reason for reporting</label>
                <select 
                  className="form-input" 
                  value={reportReason} 
                  onChange={(e) => setReportReason(e.target.value)}
                  required
                  style={{ background: 'hsla(220, 20%, 8%, 0.8)' }}
                >
                  <option value="">Select a reason...</option>
                  <option value="spam">Spam or misleading</option>
                  <option value="hate_speech">Hate speech or symbols</option>
                  <option value="violence">Violence or dangerous organizations</option>
                  <option value="nudity">Nudity or sexual activity</option>
                  <option value="harassment">Harassment or bullying</option>
                  <option value="other">Other violations</option>
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={() => setActivePostForReport(null)}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary" 
                  disabled={reporting || !reportReason}
                >
                  {reporting ? 'Submitting...' : 'Submit Report'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Feed;
