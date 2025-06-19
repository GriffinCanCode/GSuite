// CheatSheets Hub API Client
// Connects the frontend to the backend API

const API_URL = 'http://localhost:5001/api';
// Ensure API URL is always available
window.CHEATSHEETS_API_URL = API_URL;

// Utility function to store token
const setToken = (token) => {
  localStorage.setItem('cheatsheets_token', token);
};

// Utility function to get stored token
const getToken = () => {
  return localStorage.getItem('cheatsheets_token');
};

// Utility function to clear token
const clearToken = () => {
  localStorage.removeItem('cheatsheets_token');
};

// Utility function to check if user is logged in
const isLoggedIn = () => {
  return !!getToken();
};

// Make API requests with proper headers
const fetchAPI = async (endpoint, options = {}) => {
  const token = getToken();
  
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  const config = {
    ...options,
    headers
  };
  
  try {
    const response = await fetch(`${API_URL}${endpoint}`, config);
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Something went wrong');
    }
    
    return data;
  } catch (error) {
    console.error('API Error:', error);
    throw error;
  }
};

// Cheatsheet APIs
const sheetsAPI = {
  // Get all sheets
  getSheets: async (filter = {}) => {
    const { category, tag, search } = filter;
    let url = '/sheets';
    const params = new URLSearchParams();
    
    if (category) params.append('category', category);
    if (tag) params.append('tag', tag);
    if (search) params.append('search', search);
    
    if (params.toString()) {
      url += `?${params.toString()}`;
    }
    
    return fetchAPI(url);
  },
  
  // Get a specific sheet
  getSheet: async (id) => {
    return fetchAPI(`/sheets/${id}`);
  },
  
  // Create a new sheet
  createSheet: async (sheetData) => {
    return fetchAPI('/sheets', {
      method: 'POST',
      body: JSON.stringify(sheetData)
    });
  },
  
  // Update a sheet
  updateSheet: async (id, sheetData) => {
    return fetchAPI(`/sheets/${id}`, {
      method: 'PUT',
      body: JSON.stringify(sheetData)
    });
  },
  
  // Delete a sheet
  deleteSheet: async (id) => {
    return fetchAPI(`/sheets/${id}`, {
      method: 'DELETE'
    });
  },
  
  // Upload a file
  uploadFile: async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    
    const token = getToken();
    const headers = {};
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    try {
      const response = await fetch(`${API_URL}/sheets/upload`, {
        method: 'POST',
        headers,
        body: formData
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Something went wrong');
      }
      
      return data;
    } catch (error) {
      console.error('Upload Error:', error);
      throw error;
    }
  }
};

// User APIs
const userAPI = {
  // Register a new user
  register: async (userData) => {
    const response = await fetchAPI('/users/register', {
      method: 'POST',
      body: JSON.stringify(userData)
    });
    
    return response;
  },
  
  // Login user
  login: async (credentials) => {
    const response = await fetchAPI('/users/login', {
      method: 'POST',
      body: JSON.stringify(credentials)
    });
    
    if (response.success) {
      setToken(response.token);
    }
    
    return response;
  },
  
  // Logout user
  logout: () => {
    clearToken();
  },
  
  // Get user profile
  getProfile: async () => {
    return fetchAPI('/users/profile');
  },
  
  // Update user profile
  updateProfile: async (profileData) => {
    return fetchAPI('/users/profile', {
      method: 'PUT',
      body: JSON.stringify(profileData)
    });
  },
  
  // Add to favorites
  addFavorite: async (sheetId) => {
    return fetchAPI(`/users/favorites/${sheetId}`, {
      method: 'POST'
    });
  },
  
  // Remove from favorites
  removeFavorite: async (sheetId) => {
    return fetchAPI(`/users/favorites/${sheetId}`, {
      method: 'DELETE'
    });
  }
};

// Export the API
const api = {
  sheets: sheetsAPI,
  user: userAPI,
  isLoggedIn,
  getToken,
  setToken,
  clearToken,
  
  // Check backend health
  checkHealth: async () => {
    try {
      const response = await fetch(`${API_URL}/health`);
      return await response.json();
    } catch (error) {
      console.error('Health check failed:', error);
      return { success: false, error: error.message };
    }
  }
};

// Make API available globally
window.CheatSheetsAPI = api;

export default api; 