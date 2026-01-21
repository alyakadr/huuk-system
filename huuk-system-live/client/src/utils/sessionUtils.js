/**
 * Session Management Utility
 * Provides role-based localStorage management to prevent session conflicts
 * between staff and customer interfaces
 */

// Session keys for different user roles
const SESSION_KEYS = {
  STAFF: {
    USER: 'staff_loggedInUser',
    TOKEN: 'staff_token',
    USER_ID: 'staff_userId'
  },
  CUSTOMER: {
    USER: 'customer_loggedInUser',
    TOKEN: 'customer_token',
    USER_ID: 'customer_userId'
  }
};

/**
 * Get session keys based on user role
 */
export const getSessionKeys = (role) => {
  if (role === 'customer') {
    return SESSION_KEYS.CUSTOMER;
  }
  return SESSION_KEYS.STAFF; // Default to staff for staff/manager roles
};

/**
 * Set user session data
 */
export const setUserSession = (userData, token) => {
  const keys = getSessionKeys(userData.role);
  
  localStorage.setItem(keys.USER, JSON.stringify(userData));
  localStorage.setItem(keys.TOKEN, token);
  localStorage.setItem(keys.USER_ID, String(userData.id));
};

/**
 * Get user session data
 */
export const getUserSession = (role) => {
  const keys = getSessionKeys(role);
  
  const userStr = localStorage.getItem(keys.USER);
  const token = localStorage.getItem(keys.TOKEN);
  const userId = localStorage.getItem(keys.USER_ID);
  
  if (!userStr || !token) {
    return null;
  }
  
  try {
    const user = JSON.parse(userStr);
    return { user, token, userId };
  } catch (error) {
    console.error('Error parsing user session:', error);
    return null;
  }
};

/**
 * Clear user session data
 */
export const clearUserSession = (role) => {
  const keys = getSessionKeys(role);
  
  localStorage.removeItem(keys.USER);
  localStorage.removeItem(keys.TOKEN);
  localStorage.removeItem(keys.USER_ID);
};

/**
 * Get current user from session (tries both staff and customer)
 */
export const getCurrentUser = () => {
  // Try staff first
  const staffSession = getUserSession('staff');
  if (staffSession) {
    return staffSession;
  }
  
  // Try customer
  const customerSession = getUserSession('customer');
  if (customerSession) {
    return customerSession;
  }
  
  return null;
};

/**
 * Check if user is authenticated for specific role
 */
export const isAuthenticated = (role) => {
  const session = getUserSession(role);
  return session !== null;
};

/**
 * Get token for API requests based on context
 */
export const getAuthToken = (context = 'staff') => {
  const keys = getSessionKeys(context);
  return localStorage.getItem(keys.TOKEN);
};

export default {
  getSessionKeys,
  setUserSession,
  getUserSession,
  clearUserSession,
  getCurrentUser,
  isAuthenticated,
  getAuthToken
};
