import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Register from './pages/Register';
import Feed from './pages/Feed';
import Profile from './pages/Profile';
import Notifications from './pages/Notifications';
import Admin from './pages/Admin';
import LoadingSpinner from './components/LoadingSpinner';

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ 
        height: '100vh', 
        width: '100vw', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        background: 'hsl(var(--bg-color))'
      }}>
        <LoadingSpinner />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

const PublicRoute = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ 
        height: '100vh', 
        width: '100vw', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        background: 'hsl(var(--bg-color))'
      }}>
        <LoadingSpinner />
      </div>
    );
  }

  if (user) {
    return <Navigate to="/" replace />;
  }

  return children;
};

function App() {
  const handleCreatePostClick = () => {
    if (window.location.pathname === '/') {
      const box = document.querySelector('.create-post-box');
      if (box) {
        box.scrollIntoView({ behavior: 'smooth' });
        const textarea = box.querySelector('textarea');
        if (textarea) textarea.focus();
      }
    } else {
      window.location.href = '/';
    }
  };

  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public Authentication Routes */}
          <Route path="/login" element={
            <PublicRoute>
              <Login />
            </PublicRoute>
          } />
          <Route path="/register" element={
            <PublicRoute>
              <Register />
            </PublicRoute>
          } />

          {/* Protected Application Routes */}
          <Route path="/" element={
            <ProtectedRoute>
              <Layout onCreatePostClick={handleCreatePostClick} />
            </ProtectedRoute>
          }>
            <Route index element={<Feed />} />
            <Route path="profile/:username" element={<Profile />} />
            <Route path="notifications" element={<Notifications />} />
            <Route path="admin" element={<Admin />} />
          </Route>

          {/* Catch-all Route redirects to Feed */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
