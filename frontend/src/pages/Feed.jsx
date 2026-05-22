import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  Heart,
  MessageSquare,
  Trash2,
  ShieldAlert,
  Image,
  Film,
  Send,
  X,
  MoreVertical,
  Flag,
  UploadCloud,
  ChevronRight,
  Compass,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import api, { API_BASE_URL } from "../services/api";
import LoadingSpinner from "../components/LoadingSpinner";
import "./Feed.css";

// Extract the host URL (e.g., http://localhost:8080) from API_BASE_URL
const BACKEND_HOST = API_BASE_URL.replace("/api", "");

// Premium Carousel component for multi-media rendering
const PostMedia = ({ media, defaultUrl, defaultType }) => {
  const [index, setIndex] = useState(0);

  // Fallback to legacy single file parameters if media array is empty
  const items =
    media && media.length > 0
      ? media
      : [{ media_url: defaultUrl, media_type: defaultType }];

  const nextMedia = (e) => {
    e.stopPropagation();
    setIndex((prev) => (prev + 1) % items.length);
  };

  const prevMedia = (e) => {
    e.stopPropagation();
    setIndex((prev) => (prev - 1 + items.length) % items.length);
  };

  const currentItem = items[index];
  if (!currentItem || !currentItem.media_url) return null;
  const formattedUrl = currentItem.media_url.startsWith("http")
    ? currentItem.media_url
    : `${BACKEND_HOST}${currentItem.media_url}`;

  return (
    <div className="post-media-container">
      <div
        className="post-media-blur-bg"
        style={
          currentItem.media_type === "image"
            ? { backgroundImage: `url(${formattedUrl})` }
            : { background: "linear-gradient(to bottom, #111, #000)" }
        }
      />
      {currentItem.media_type === "image" ? (
        <img
          src={formattedUrl}
          className="post-image"
          alt="Post content"
          loading="lazy"
        />
      ) : (
        <video
          src={formattedUrl}
          className="post-video"
          controls
          preload="metadata"
        />
      )}

      {items.length > 1 && (
        <>
          <button className="carousel-btn prev" onClick={prevMedia}>
            &#8249;
          </button>
          <button className="carousel-btn next" onClick={nextMedia}>
            &#8250;
          </button>
          <div className="carousel-dots">
            {items.map((_, i) => (
              <span
                key={i}
                className={`carousel-dot ${i === index ? "active" : ""}`}
                onClick={(e) => {
                  e.stopPropagation();
                  setIndex(i);
                }}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
};

const Feed = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Feed posts state
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);

  // Create post states
  const [caption, setCaption] = useState("");
  const [mediaFiles, setMediaFiles] = useState([]); // Array of File objects
  const [mediaPreviews, setMediaPreviews] = useState([]); // Array of { url, type, name }
  const [albumId, setAlbumId] = useState("");
  const [visibility, setVisibility] = useState("public");
  const [albums, setAlbums] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef(null);

  // Fetch user albums when component mounts/user changes
  useEffect(() => {
    if (user?.id) {
      fetchUserAlbums();
    }
  }, [user]);

  const fetchUserAlbums = async () => {
    try {
      const response = await api.get(`/users/${user.id}/albums`);
      if (response.success) {
        setAlbums(response.data || []);
      }
    } catch (err) {
      console.error("Error fetching user albums:", err);
    }
  };

  // Comments drawer states
  const [activePostForComments, setActivePostForComments] = useState(null);
  const [comments, setComments] = useState([]);
  const [newCommentText, setNewCommentText] = useState("");
  const [loadingComments, setLoadingComments] = useState(false);

  // Dropdown menu state
  const [activeMenuId, setActiveMenuId] = useState(null);

  // Report modal states
  const [activePostForReport, setActivePostForReport] = useState(null);
  const [reportReason, setReportReason] = useState("");
  const [reporting, setReporting] = useState(false);

  // Like animations state
  const [animatingLikes, setAnimatingLikes] = useState({});

  // Fetch initial posts feed
  useEffect(() => {
    fetchFeed();
  }, []);

  const fetchFeed = async () => {
    setLoading(true);
    try {
      const response = await api.get("/posts?page=1&limit=10000");
      if (response.success && Array.isArray(response.data)) {
        setPosts(response.data);
      }
    } catch (err) {
      console.error("Error fetching feed:", err);
    } finally {
      setLoading(false);
    }
  };

  // Like / Unlike action
  const handleLike = async (postId, likedByMe) => {
    // Trigger pop animation if liking
    if (!likedByMe) {
      setAnimatingLikes((prev) => ({ ...prev, [postId]: true }));
      setTimeout(() => {
        setAnimatingLikes((prev) => {
          const next = { ...prev };
          delete next[postId];
          return next;
        });
      }, 600);
    }

    // Optimistic UI updates
    setPosts((prevPosts) =>
      prevPosts.map((post) => {
        if (post.id === postId) {
          return {
            ...post,
            liked_by_me: !likedByMe,
            likes_count: likedByMe
              ? post.likes_count - 1
              : post.likes_count + 1,
          };
        }
        return post;
      }),
    );

    try {
      const endpoint = `/posts/${postId}/${likedByMe ? "unlike" : "like"}`;
      await api.post(endpoint);
    } catch (err) {
      console.error("Error toggling like:", err);
      // Revert state if failed
      setPosts((prevPosts) =>
        prevPosts.map((post) => {
          if (post.id === postId) {
            return {
              ...post,
              liked_by_me: likedByMe,
              likes_count: likedByMe
                ? post.likes_count + 1
                : post.likes_count - 1,
            };
          }
          return post;
        }),
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
      console.error("Error loading comments:", err);
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
    setNewCommentText("");

    try {
      const response = await api.post(
        `/posts/${activePostForComments.id}/comments`,
        {
          content: commentContent,
        },
      );

      if (response.success && response.data) {
        // Enriched comment item
        const newComment = {
          ...response.data,
          user: {
            id: user.id,
            username: user.username,
            avatar: user.avatar,
            role: user.role,
          },
        };
        setComments((prev) => [newComment, ...prev]);

        // Increment comments counter on target post
        setPosts((prevPosts) =>
          prevPosts.map((p) => {
            if (p.id === activePostForComments.id) {
              return { ...p, comments_count: p.comments_count + 1 };
            }
            return p;
          }),
        );
      }
    } catch (err) {
      console.error("Error creating comment:", err);
    }
  };

  // Delete Post
  const handleDeletePost = async (postId) => {
    if (!window.confirm("Are you sure you want to delete this post?")) return;

    try {
      const response = await api.delete(`/posts/${postId}`);
      if (response.success) {
        setPosts((prev) => prev.filter((post) => post.id !== postId));
        setActiveMenuId(null);
      }
    } catch (err) {
      console.error("Error deleting post:", err);
    }
  };

  // Report Post
  const handleReportPost = async (e) => {
    e.preventDefault();
    if (!reportReason.trim() || !activePostForReport) return;
    setReporting(true);

    try {
      const response = await api.post(
        `/posts/${activePostForReport.id}/report`,
        {
          reason: reportReason,
        },
      );

      if (response.success) {
        alert(
          "Thank you for your report. The administrative moderation team will review it.",
        );
        setActivePostForReport(null);
        setReportReason("");
      }
    } catch (err) {
      console.error("Error reporting post:", err);
    } finally {
      setReporting(false);
    }
  };

  // File Upload Handlers
  const handleFileChange = (e) => {
    const files = Array.from(e.target.files);
    processSelectedFiles(files);
  };

  const processSelectedFiles = (files) => {
    if (!files || files.length === 0) return;

    const newFiles = [];
    const newPreviews = [];

    files.forEach((file) => {
      const fileType = file.type.split("/")[0];
      if (fileType !== "image" && fileType !== "video") {
        alert(
          `Unsupported file format for ${file.name}! Please upload images or videos.`,
        );
        return;
      }
      newFiles.push(file);
      newPreviews.push({
        url: URL.createObjectURL(file),
        type: fileType,
        name: file.name,
      });
    });

    setMediaFiles((prev) => [...prev, ...newFiles]);
    setMediaPreviews((prev) => [...prev, ...newPreviews]);
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

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const files = Array.from(e.dataTransfer.files);
      processSelectedFiles(files);
    }
  };

  const removeSelectedMedia = (index) => {
    setMediaFiles((prev) => prev.filter((_, i) => i !== index));
    setMediaPreviews((prev) => {
      URL.revokeObjectURL(prev[index].url);
      return prev.filter((_, i) => i !== index);
    });
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Submit Post
  const handleCreatePost = async (e) => {
    e.preventDefault();
    if (mediaFiles.length === 0) {
      alert("Please select or drop at least one image/video first!");
      return;
    }

    setUploading(true);
    const formData = new FormData();
    formData.append("caption", caption);
    formData.append("visibility", visibility);
    if (albumId) {
      formData.append("album_id", albumId);
    }

    mediaFiles.forEach((file) => {
      formData.append("media", file);
    });

    try {
      const response = await api.post("/posts", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      if (response.success && response.data) {
        // Build the new post to insert into the top of the feed immediately
        const createdPost = {
          ...response.data,
          username: user.username,
          avatar: user.avatar,
          likes_count: 0,
          comments_count: 0,
          liked_by_me: false,
        };

        setPosts((prev) => [createdPost, ...prev]);

        // Reset form state
        setCaption("");
        setAlbumId("");
        setVisibility("public");
        // Revoke all preview URLs
        mediaPreviews.forEach((p) => URL.revokeObjectURL(p.url));
        setMediaFiles([]);
        setMediaPreviews([]);
      }
    } catch (err) {
      alert(
        err.message ||
          "Failed to create post. Media size limit could be exceeded.",
      );
    } finally {
      setUploading(false);
    }
  };

  // Helper formatting for timestamps
  const formatTime = (timeStr) => {
    const date = new Date(timeStr);
    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Build profile avatar element
  const renderAvatar = (avatarPath) => {
    if (avatarPath) {
      const src = avatarPath.startsWith("http")
        ? avatarPath
        : `${BACKEND_HOST}${avatarPath}`;
      return (
        <img
          src={src}
          className="user-avatar-sm"
          alt="Avatar"
          onError={(e) => {
            e.target.src =
              "https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y";
          }}
        />
      );
    }
    return (
      <div
        className="user-avatar-sm"
        style={{
          background:
            "linear-gradient(135deg, hsl(var(--primary)), hsl(var(--secondary)))",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#fff",
          fontSize: "0.8rem",
          fontWeight: "bold",
        }}
      >
        U
      </div>
    );
  };

  return (
    <div className="feed-container fade-in">
      {/* Create Post Section */}
      <div className="create-post-box glass">
        <div className="create-post-header">
          {renderAvatar(user?.avatar)}
          <textarea
            className="create-post-textarea"
            placeholder={`What's on your mind, ${user?.username || "user"}?`}
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
          />
        </div>

        {mediaPreviews.length > 0 ? (
          <div className="previews-carousel">
            {mediaPreviews.map((preview, idx) => (
              <div key={idx} className="preview-item">
                {preview.type === "image" ? (
                  <img
                    src={preview.url}
                    alt="preview"
                    className="preview-media-thumb"
                  />
                ) : (
                  <video
                    src={preview.url}
                    className="preview-media-thumb"
                    muted
                  />
                )}
                <button
                  className="remove-thumb-btn"
                  onClick={() => removeSelectedMedia(idx)}
                >
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div
            className={`upload-dropzone ${dragActive ? "drag-active" : ""}`}
            onDragEnter={handleDrag}
            onDragOver={handleDrag}
            onDragLeave={handleDrag}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <UploadCloud size={32} style={{ color: "hsl(var(--primary))" }} />
            <p style={{ fontWeight: "600", fontSize: "0.9rem" }}>
              Drag & Drop files or Click to Browse
            </p>
            <p style={{ fontSize: "0.75rem", color: "hsl(var(--text-muted))" }}>
              Supports multiple Images or Videos (Max 50MB per file)
            </p>
            <input
              type="file"
              ref={fileInputRef}
              style={{ display: "none" }}
              onChange={handleFileChange}
              accept="image/*,video/*"
              multiple
            />
          </div>
        )}

        <div
          className="create-post-footer"
          style={{
            flexDirection: "column",
            alignItems: "stretch",
            gap: "12px",
          }}
        >
          <div className="post-form-options">
            <select
              className="select-input-opt"
              value={albumId}
              onChange={(e) => setAlbumId(e.target.value)}
            >
              <option value="">No Album</option>
              {albums.map((album) => (
                <option key={album.id} value={album.id}>
                  {album.title}
                </option>
              ))}
            </select>

            <select
              className="select-input-opt"
              value={visibility}
              onChange={(e) => setVisibility(e.target.value)}
            >
              <option value="public">Public</option>
              <option value="followers">Followers Only</option>
            </select>
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              width: "100%",
            }}
          >
            <div className="media-upload-options">
              <span
                className="icon-btn-opt"
                onClick={() => {
                  fileInputRef.current?.click();
                }}
              >
                <Image size={18} /> Add Media
              </span>
            </div>

            <button
              className="btn btn-primary"
              onClick={handleCreatePost}
              disabled={uploading || mediaFiles.length === 0}
            >
              {uploading ? (
                <div
                  className="spinner"
                  style={{ width: "20px", height: "20px" }}
                ></div>
              ) : (
                <>
                  Share <Send size={15} />
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Posts Feed */}
      {loading ? (
        <LoadingSpinner />
      ) : posts.length === 0 ? (
        <div className="empty-feed glass">
          <Compass size={48} style={{ color: "hsl(var(--text-muted))" }} />
          <h3>No Posts Yet</h3>
          <p>
            Be the first to share a spectacular photo or video with the world!
          </p>
        </div>
      ) : (
        <div className="posts-list">
          {posts.map((post) => {
            const isPostOwner = user && post.user_id === user.id;
            const isAdmin = user && user.role === "admin";
            const showDropdown = activeMenuId === post.id;
            const formattedMediaUrl = post.media_url.startsWith("http")
              ? post.media_url
              : `${BACKEND_HOST}${post.media_url}`;

            return (
              <div key={post.id} className="post-card glass">
                {/* Post Header */}
                <div className="post-header">
                  <div
                    className="post-author"
                    onClick={() => navigate(`/profile/${post.username}`)}
                  >
                    {renderAvatar(post.avatar)}
                    <div className="author-info">
                      <span className="author-username">{post.username}</span>
                      <span className="post-time">
                        {formatTime(post.created_at)}
                      </span>
                    </div>
                  </div>

                  <div className="post-actions-menu">
                    <button
                      className="menu-trigger"
                      onClick={() =>
                        setActiveMenuId(showDropdown ? null : post.id)
                      }
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
                {post.caption && <p className="post-caption">{post.caption}</p>}

                {/* Post Media */}
                <PostMedia
                  media={post.media}
                  defaultUrl={post.media_url}
                  defaultType={post.media_type}
                />

                {/* Actions */}
                <div className="post-actions-bar">
                  <button
                    className={`action-btn ${post.liked_by_me ? "liked" : ""}`}
                    onClick={() => handleLike(post.id, post.liked_by_me)}
                  >
                    <Heart
                      size={20}
                      className={animatingLikes[post.id] ? "heart-pop" : ""}
                    />
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


        </div>
      )}

      {/* Drawer for Comments */}
      {activePostForComments && (
        <div className="drawer-backdrop" onClick={closeCommentsDrawer}>
          <div
            className="drawer-content glass"
            onClick={(e) => e.stopPropagation()}
          >
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
                <div
                  style={{
                    textAlign: "center",
                    padding: "40px 0",
                    color: "hsl(var(--text-muted))",
                  }}
                >
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
                          <span className="comment-author">
                            {comment.user?.username || "user"}
                          </span>
                          <span className="comment-time">
                            {formatTime(comment.created_at)}
                          </span>
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
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ padding: "10px 14px" }}
                >
                  <Send size={16} />
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Report Modal */}
      {activePostForReport && (
        <div
          className="modal-overlay"
          onClick={() => setActivePostForReport(null)}
        >
          <div
            className="modal-content glass"
            onClick={(e) => e.stopPropagation()}
          >
            <h3
              style={{
                fontFamily: "var(--font-secondary)",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <ShieldAlert style={{ color: "hsl(var(--accent))" }} /> Report
              Post
            </h3>
            <p
              style={{
                fontSize: "0.9rem",
                color: "hsl(var(--text-secondary))",
              }}
            >
              Help us understand what is wrong with this post. Your report is
              anonymous.
            </p>

            <form onSubmit={handleReportPost}>
              <div className="form-group">
                <label className="form-label">Reason for reporting</label>
                <select
                  className="form-input"
                  value={reportReason}
                  onChange={(e) => setReportReason(e.target.value)}
                  required
                  style={{ background: "hsla(220, 20%, 8%, 0.8)" }}
                >
                  <option value="">Select a reason...</option>
                  <option value="spam">Spam or misleading</option>
                  <option value="hate_speech">Hate speech or symbols</option>
                  <option value="violence">
                    Violence or dangerous organizations
                  </option>
                  <option value="nudity">Nudity or sexual activity</option>
                  <option value="harassment">Harassment or bullying</option>
                  <option value="other">Other violations</option>
                </select>
              </div>

              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: "10px",
                  marginTop: "10px",
                }}
              >
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
                  {reporting ? "Submitting..." : "Submit Report"}
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
