import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Check if user is logged in on mount
  useEffect(() => {
    const initAuth = async () => {
      const token = localStorage.getItem('access_token');
      if (token) {
        try {
          // Fetch current user details from /users/me
          const response = await api.get('/users/me');
          if (response.success) {
            setUser(response.data);
            localStorage.setItem('username', response.data.username);
            localStorage.setItem('role', response.data.role);
          } else {
            handleLogoutCleanup();
          }
        } catch (err) {
          console.error("Error fetching current user:", err);
          handleLogoutCleanup();
        }
      }
      setLoading(false);
    };

    initAuth();
  }, []);

  const login = async (email, password) => {
    try {
      const response = await api.post('/auth/login', { email, password });
      if (response.success && response.data) {
        const { access_token, refresh_token, user: userData } = response.data;
        localStorage.setItem('access_token', access_token);
        localStorage.setItem('refresh_token', refresh_token);
        localStorage.setItem('username', userData.username);
        localStorage.setItem('role', userData.role);
        setUser(userData);
        return { success: true };
      }
      return { success: false, message: response.message || "Login failed" };
    } catch (err) {
      return { success: false, message: err.message || "Invalid credentials" };
    }
  };

  const register = async (username, email, password) => {
    try {
      const response = await api.post('/auth/register', { username, email, password });
      return response;
    } catch (err) {
      return { success: false, message: err.message || "Registration failed" };
    }
  };

  const logout = async () => {
    const refreshToken = localStorage.getItem('refresh_token');
    if (refreshToken) {
      try {
        await api.post('/auth/logout', { refresh_token: refreshToken });
      } catch (err) {
        console.error("Logout request error:", err);
      }
    }
    handleLogoutCleanup();
  };

  const handleLogoutCleanup = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('username');
    localStorage.removeItem('role');
    setUser(null);
  };

  const updateProfileState = (updatedUser) => {
    if (updatedUser.username) {
      localStorage.setItem('username', updatedUser.username);
    }
    if (updatedUser.role) {
      localStorage.setItem('role', updatedUser.role);
    }
    setUser((prev) => ({ ...prev, ...updatedUser }));
  };

  const value = {
    user,
    loading,
    login,
    register,
    logout,
    updateProfileState,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
