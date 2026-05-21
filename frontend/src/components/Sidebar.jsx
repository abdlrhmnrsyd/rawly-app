import React, { useEffect, useState } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { Home, Bell, User, PlusSquare, LogOut, ShieldAlert, Sparkles } from 'lucide-react';
import api from '../services/api';
import './Sidebar.css';

export default function Sidebar({ onCreatePostClick }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [unreadCount, setUnreadCount] = useState(0);
  
  const username = localStorage.getItem('username') || 'profile';
  const role = localStorage.getItem('role');

  const fetchUnreadNotifications = async () => {
    try {
      const res = await api.get('/notifications?limit=100');
      if (res.success && res.data) {
        const unread = res.data.filter(n => !n.is_read).length;
        setUnreadCount(unread);
      }
    } catch (err) {
      console.error('Failed to fetch unread notification count', err);
    }
  };

  useEffect(() => {
    // Only fetch if authenticated
    if (localStorage.getItem('access_token')) {
      fetchUnreadNotifications();
      // Poll every 30 seconds for live notification badges
      const interval = setInterval(fetchUnreadNotifications, 30000);
      return () => clearInterval(interval);
    }
  }, [location.pathname]); // Fetch on route change

  const handleLogout = async () => {
    const refreshToken = localStorage.getItem('refresh_token');
    if (refreshToken) {
      try {
        await api.post('/auth/logout', { refresh_token: refreshToken });
      } catch (err) {
        console.error('Failed to logout gracefully from backend', err);
      }
    }
    
    // Clear storage
    localStorage.clear();
    navigate('/login');
  };

  return (
    <aside className="sidebar glass">
      <div className="logo-container">
        <Sparkles size={28} color="hsl(var(--primary))" />
        <span className="logo-text">Rawly</span>
      </div>

      <nav className="nav-links">
        <div className="nav-item">
          <NavLink to="/" className="nav-link" end>
            <Home size={22} />
            <span>Home</span>
          </NavLink>
        </div>

        <div className="nav-item">
          <button 
            className="nav-link btn-text" 
            style={{ width: '100%', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer' }}
            onClick={onCreatePostClick}
          >
            <PlusSquare size={22} />
            <span>Create Post</span>
          </button>
        </div>

        <div className="nav-item">
          <NavLink to="/notifications" className="nav-link">
            <Bell size={22} />
            <span>Notifications</span>
            {unreadCount > 0 && <span className="nav-badge">{unreadCount}</span>}
          </NavLink>
        </div>

        <div className="nav-item">
          <NavLink to={`/profile/${username}`} className="nav-link">
            <User size={22} />
            <span>Profile</span>
          </NavLink>
        </div>

        {role === 'admin' && (
          <div className="nav-item">
            <NavLink to="/admin" className="nav-link">
              <ShieldAlert size={22} />
              <span>Admin Panel</span>
            </NavLink>
          </div>
        )}

        <div className="nav-item logout-item">
          <button 
            onClick={handleLogout} 
            className="nav-link btn-text" 
            style={{ width: '100%', display: 'flex', gap: '12px', border: 'none', background: 'none', cursor: 'pointer' }}
          >
            <LogOut size={22} color="hsl(var(--danger))" />
            <span style={{ color: 'hsl(var(--danger))' }}>Logout</span>
          </button>
        </div>
      </nav>
    </aside>
  );
}
