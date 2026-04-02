// Token migration utility to handle token inconsistencies
import http from "./httpClient";

const API_BASE_URL = process.env.REACT_APP_API_URL ? `${process.env.REACT_APP_API_URL}/api` : "http://localhost:5000/api";

// Prevent multiple simultaneous migrations
let isMigrating = false;
let migrationPromise = null;

export const migrateTokens = async () => {
  // If already migrating, return the existing promise
  if (isMigrating && migrationPromise) {
    return migrationPromise;
  }
  
  // Set migration flag and create promise
  isMigrating = true;
  migrationPromise = performMigration();
  
  try {
    const result = await migrationPromise;
    return result;
  } finally {
    // Reset migration state
    isMigrating = false;
    migrationPromise = null;
  }
};

const performMigration = async () => {
  try {
    // Get current stored tokens
    const token = localStorage.getItem('token');
    const staffToken = localStorage.getItem('staff_token');
    const loggedInUser = localStorage.getItem('loggedInUser');
    const staffLoggedInUser = localStorage.getItem('staff_loggedInUser');
    
    console.log('🔄 Starting token migration...');
    
    // If we have a legacy token but no staff token, copy it
    if (token && !staffToken) {
      console.log('📝 Copying legacy token to staff token');
      localStorage.setItem('staff_token', token);
    }
    
    // If we have a legacy user but no staff user, copy it
    if (loggedInUser && !staffLoggedInUser) {
      console.log('📝 Copying legacy user to staff user');
      localStorage.setItem('staff_loggedInUser', loggedInUser);
    }
    
    // Try to validate the current token
    const currentToken = localStorage.getItem('staff_token') || localStorage.getItem('token');
    if (!currentToken) {
      console.log('❌ No token found, migration not needed');
      return false;
    }
    
    // Try to validate token with backend
    try {
      const response = await http.get(`${API_BASE_URL}/auth/validate`, {
        headers: {
          'Authorization': `Bearer ${currentToken}`
        },
        timeout: 10000 // 10 second timeout
      });
      
      if (response.data.success) {
        console.log('✅ Token is valid, migration successful');
        
        // Ensure consistency across all token storage keys
        if (currentToken !== localStorage.getItem('staff_token')) {
          localStorage.setItem('staff_token', currentToken);
        }
        if (currentToken !== localStorage.getItem('token')) {
          localStorage.setItem('token', currentToken);
        }
        
        return true;
      }
    } catch (error) {
      console.log('⚠️ Token validation failed:', error.response?.status);
      
      // If token is invalid, try to refresh it
      if (error.response?.status === 401) {
        try {
          const refreshResponse = await http.post(`${API_BASE_URL}/auth/refresh`, {}, {
            headers: {
              'Authorization': `Bearer ${currentToken}`
            },
            timeout: 10000 // 10 second timeout
          });
          
          if (refreshResponse.data.success && refreshResponse.data.token) {
            console.log('🔄 Token refreshed successfully');
            
            // Update all token storage keys
            localStorage.setItem('token', refreshResponse.data.token);
            localStorage.setItem('staff_token', refreshResponse.data.token);
            
            // Update user data if provided
            if (refreshResponse.data.user) {
              const userData = JSON.stringify(refreshResponse.data.user);
              localStorage.setItem('loggedInUser', userData);
              localStorage.setItem('staff_loggedInUser', userData);
            }
            
            return true;
          }
        } catch (refreshError) {
          console.log('❌ Token refresh failed:', refreshError.response?.status);
          
          // Clear invalid tokens
          localStorage.removeItem('token');
          localStorage.removeItem('staff_token');
          localStorage.removeItem('loggedInUser');
          localStorage.removeItem('staff_loggedInUser');
          localStorage.removeItem('userId');
          localStorage.removeItem('staff_userId');
          
          return false;
        }
      }
    }
    
    return false;
  } catch (error) {
    console.error('❌ Token migration failed:', error);
    return false;
  }
};

// Function to check if user needs re-authentication
export const checkAuthStatus = () => {
  const token = localStorage.getItem('staff_token') || localStorage.getItem('token');
  const user = localStorage.getItem('staff_loggedInUser') || localStorage.getItem('loggedInUser');
  
  if (!token || !user) {
    return { isAuthenticated: false, needsLogin: true };
  }
  
  try {
    const userData = JSON.parse(user);
    return { 
      isAuthenticated: true, 
      needsLogin: false, 
      user: userData 
    };
  } catch (error) {
    console.error('Invalid user data in localStorage:', error);
    return { isAuthenticated: false, needsLogin: true };
  }
};



