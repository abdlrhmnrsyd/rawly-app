import axios from 'axios';

const API_BASE_URL = 'http://localhost:8080/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request Interceptor: Attach Access Token if available
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response Interceptor: Handle Token Expiration and Refreshing
api.interceptors.response.use(
  (response) => {
    // Return the common GORM response structure data block directly
    return response.data;
  },
  async (error) => {
    const originalRequest = error.config;
    
    // Check if error is 401 and we haven't retried this request yet
    if (error.response && error.response.status === 401 && !originalRequest._retry) {
      // Avoid infinite loop if refreshing fails
      if (originalRequest.url === '/auth/refresh' || originalRequest.url === '/auth/login') {
        return Promise.reject(error.response?.data || error);
      }
      
      originalRequest._retry = true;
      const refreshToken = localStorage.getItem('refresh_token');
      
      if (refreshToken) {
        try {
          // Attempt token refresh
          // We use direct axios call here to avoid interceptors loops
          const res = await axios.post(`${API_BASE_URL}/auth/refresh`, {
            refresh_token: refreshToken,
          });
          
          if (res.data && res.data.success) {
            const { access_token, refresh_token } = res.data.data;
            
            // Save new tokens
            localStorage.setItem('access_token', access_token);
            localStorage.setItem('refresh_token', refresh_token);
            
            // Update auth headers and retry original request
            originalRequest.headers.Authorization = `Bearer ${access_token}`;
            return api(originalRequest);
          }
        } catch (refreshErr) {
          // Refresh failed (e.g. token expired, banned)
          handleLogoutCleanup();
          return Promise.reject(refreshErr.response?.data || refreshErr);
        }
      } else {
        handleLogoutCleanup();
      }
    }
    
    // Return standard error envelope if available
    return Promise.reject(error.response?.data || error);
  }
);

function handleLogoutCleanup() {
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
  // Broadcast logout event or redirect if window is available
  if (typeof window !== 'undefined' && window.location.pathname !== '/login' && window.location.pathname !== '/register') {
    window.location.href = '/login';
  }
}

export default api;
export { API_BASE_URL };
