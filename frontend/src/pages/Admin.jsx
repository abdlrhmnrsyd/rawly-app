import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ShieldAlert, Trash2, UserMinus, UserCheck, 
  CheckCircle, ShieldCheck, Eye, ExternalLink, X, Film, Image
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api, { API_BASE_URL } from '../services/api';
import LoadingSpinner from '../components/LoadingSpinner';
import './Admin.css';

const BACKEND_HOST = API_BASE_URL.replace('/api', '');

const Admin = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null); // stores reportId of active action

  useEffect(() => {
    // Redirect if not admin
    if (user && user.role !== 'admin') {
      navigate('/');
      return;
    }
    fetchReports();
  }, [user]);

  const fetchReports = async () => {
    setLoading(true);
    try {
      const response = await api.get('/admin/reports?page=1&limit=50');
      if (response.success && Array.isArray(response.data)) {
        setReports(response.data);
      }
    } catch (err) {
      console.error('Error fetching admin reports:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleForceDelete = async (reportId, postId) => {
    if (!window.confirm("Are you sure you want to FORCE DELETE this post? This action is permanent and overrides the owner's permissions.")) return;
    
    setActionLoading(reportId);
    try {
      const response = await api.delete(`/admin/posts/${postId}`);
      if (response.success) {
        // Remove all reports related to this deleted post from the list
        setReports(prev => prev.filter(r => r.post_id !== postId));
        alert("Post removed successfully by administrative override.");
      }
    } catch (err) {
      alert(err.message || "Failed to override and delete post.");
    } finally {
      setActionLoading(null);
    }
  };

  const handleBanUser = async (reportId, authorId, username) => {
    if (!window.confirm(`Are you sure you want to BAN user @${username}? They will no longer be able to log in or create posts.`)) return;

    setActionLoading(reportId);
    try {
      const response = await api.post(`/admin/users/${authorId}/ban`, {
        is_banned: true
      });

      if (response.success) {
        alert(`User @${username} has been successfully banned.`);
        // Optionally refresh or keep reported items
        fetchReports();
      }
    } catch (err) {
      alert(err.message || `Failed to ban user @${username}.`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDismissReport = (reportId) => {
    // Dismiss locally since there is no custom delete report endpoint,
    // or just let it drop off the list.
    setReports(prev => prev.filter(r => r.id !== reportId));
  };

  const formatTime = (timeStr) => {
    const date = new Date(timeStr);
    return date.toLocaleDateString(undefined, { 
      month: 'short', 
      day: 'numeric', 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  if (user && user.role !== 'admin') {
    return null;
  }

  return (
    <div className="admin-container fade-in">
      {/* Header */}
      <div className="admin-header">
        <h2 className="admin-title">
          <ShieldAlert size={28} style={{ color: 'hsl(var(--accent))' }} />
          Administrative Moderation Panel
        </h2>
        <p style={{ color: 'hsl(var(--text-secondary))', marginTop: '6px', fontSize: '0.95rem' }}>
          Moderate reported items, review flag categories, and toggle user bans below.
        </p>
      </div>

      {/* Reports List */}
      {loading ? (
        <LoadingSpinner />
      ) : reports.length === 0 ? (
        <div className="empty-reports glass">
          <ShieldCheck size={50} style={{ color: 'hsl(var(--success))' }} />
          <h3>Workspace Clean</h3>
          <p>Hooray! No reported posts require administrative reviews at this time.</p>
        </div>
      ) : (
        <div className="reports-list">
          {reports.map((report) => {
            const author = report.post?.user || {};
            const mediaUrl = report.post?.media_url;
            const formattedMedia = mediaUrl 
              ? (mediaUrl.startsWith('http') ? mediaUrl : `${BACKEND_HOST}${mediaUrl}`)
              : '';

            return (
              <div key={report.id} className="report-card glass">
                {/* Card Header */}
                <div className="report-card-header">
                  <span className="reporter-info">
                    Flagged by <span className="reporter-highlight">@{report.reporter?.username || 'user'}</span>
                  </span>
                  <span className="report-reason-badge">
                    {report.reason}
                  </span>
                </div>

                {/* Card Body */}
                <div className="report-card-body">
                  {/* Reported Media Preview */}
                  {formattedMedia && (
                    <div className="reported-post-media">
                      {/* Check if post media is video or image */}
                      {report.post?.media_type === 'video' ? (
                        <video src={formattedMedia} className="reported-media-thumb" muted preload="metadata" />
                      ) : (
                        <img src={formattedMedia} className="reported-media-thumb" alt="Flagged media" />
                      )}
                    </div>
                  )}

                  {/* Post details */}
                  <div className="reported-post-details">
                    <div>
                      <div className="post-author-row">
                        <span>Author: </span>
                        <span className="post-author-name">
                          @{report.post?.username || author.username || 'unknown'}
                        </span>
                        <span className="report-date">{formatTime(report.created_at)}</span>
                      </div>
                      
                      <p className="post-caption-preview">
                        "{report.post?.caption || 'No caption'}"
                      </p>
                    </div>

                    {/* Actions */}
                    <div className="admin-actions">
                      <button 
                        className="btn btn-danger btn-admin-action"
                        onClick={() => handleForceDelete(report.id, report.post_id)}
                        disabled={actionLoading === report.id}
                      >
                        <Trash2 size={14} /> Force Delete Post
                      </button>

                      <button 
                        className="btn btn-secondary btn-admin-action"
                        onClick={() => handleBanUser(report.id, report.post?.user_id || author.id, report.post?.username || author.username)}
                        disabled={actionLoading === report.id}
                        style={{ color: 'hsl(var(--danger))', borderColor: 'hsla(var(--danger), 0.2)' }}
                      >
                        <UserMinus size={14} /> Ban Author
                      </button>

                      <button 
                        className="btn btn-secondary btn-admin-action"
                        onClick={() => handleDismissReport(report.id)}
                        disabled={actionLoading === report.id}
                      >
                        <CheckCircle size={14} /> Dismiss Report
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Admin;
