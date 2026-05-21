import React, { useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import Sidebar from './Sidebar';
import './Layout.css';

export default function Layout({ onCreatePostClick }) {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState([
    { id: '1', name: 'Rawly Admin', username: 'admin', avatar: null, isFollowing: false },
    { id: '2', name: 'John Doe', username: 'johndoe', avatar: null, isFollowing: false },
    { id: '3', name: 'Flutter Dev', username: 'flutter_dev', avatar: null, isFollowing: false }
  ]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    const query = searchQuery.trim();
    if (query) {
      navigate(`/profile/${query}`);
      setSearchQuery('');
    }
  };

  const handleFollowToggle = (id) => {
    setSuggestions(prev => prev.map(s => {
      if (s.id === id) {
        return { ...s, isFollowing: !s.isFollowing };
      }
      return s;
    }));
  };

  return (
    <div className="app-container">
      {/* Sidebar Navigasi Kiri */}
      <Sidebar onCreatePostClick={onCreatePostClick} />

      {/* Konten Utama */}
      <main className="main-content">
        <Outlet />
      </main>

      {/* Sidebar Kanan */}
      <aside className="right-sidebar">
        <form onSubmit={handleSearchSubmit} className="search-box">
          <Search size={18} color="hsl(var(--text-secondary))" />
          <input
            type="text"
            className="search-input"
            placeholder="Search profiles..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </form>

        <div className="sidebar-widget glass">
          <h3 className="widget-title">Who to follow</h3>
          <div className="suggestions-list">
            {suggestions.map((user) => (
              <div key={user.id} className="suggestion-card">
                <img
                  className="suggestion-avatar"
                  src={user.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${user.username}`}
                  alt={user.username}
                />
                <div className="suggestion-info">
                  <span className="suggestion-name">{user.name}</span>
                  <span className="suggestion-handle">@{user.username}</span>
                </div>
                <button
                  className={`follow-btn ${user.isFollowing ? 'following' : ''}`}
                  onClick={() => handleFollowToggle(user.id)}
                >
                  {user.isFollowing ? 'Following' : 'Follow'}
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="sidebar-footer">
          <a href="#">About</a>
          <a href="#">Help Center</a>
          <a href="#">Terms of Service</a>
          <a href="#">Privacy Policy</a>
          <span>© 2026 Rawly App Inc.</span>
        </div>
      </aside>
    </div>
  );
}
