// API Configuration for different environments
const config = {
  development: {
    apiUrl: 'http://localhost:5000'
  },
  production: {
    apiUrl: process.env.REACT_APP_API_URL || 'https://huuk-system-production.up.railway.app'
  }
};

export const API_URL = config[process.env.NODE_ENV || 'development'].apiUrl;

// Export default API configuration
export const apiConfig = {
  baseURL: API_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
};