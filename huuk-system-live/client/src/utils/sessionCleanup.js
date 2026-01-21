/**
 * Session Cleanup Utility
 * Provides functions to clear all session data and prevent conflicts
 * between customer and staff interfaces
 */

/**
 * Clear all authentication-related localStorage data
 */
export const clearAllSessions = () => {
  console.log('🧹 Clearing all session data...');
  
  // Clear all user data
  localStorage.removeItem('loggedInUser');
  localStorage.removeItem('staff_loggedInUser');
  localStorage.removeItem('customer_loggedInUser');
  
  // Clear all tokens
  localStorage.removeItem('token');
  localStorage.removeItem('staff_token');
  localStorage.removeItem('customer_token');
  
  // Clear all user IDs
  localStorage.removeItem('userId');
  localStorage.removeItem('staff_userId');
  localStorage.removeItem('customer_userId');
  
  // Clear attendance-related data
  localStorage.removeItem('isTimeInConfirmed');
  
  // Clear any other session-related data
  localStorage.removeItem('lastVisitedPage');
  localStorage.removeItem('switchModeTimestamp');
  
  console.log('✅ All session data cleared');
};

/**
 * Clear only customer session data
 */
export const clearCustomerSession = () => {
  console.log('🧹 Clearing customer session data...');
  
  localStorage.removeItem('customer_loggedInUser');
  localStorage.removeItem('customer_token');
  localStorage.removeItem('customer_userId');
  
  console.log('✅ Customer session data cleared');
};

/**
 * Clear only staff session data
 */
export const clearStaffSession = () => {
  console.log('🧹 Clearing staff session data...');
  
  localStorage.removeItem('staff_loggedInUser');
  localStorage.removeItem('staff_token');
  localStorage.removeItem('staff_userId');
  localStorage.removeItem('isTimeInConfirmed');
  
  console.log('✅ Staff session data cleared');
};

/**
 * Clear legacy session data (for backward compatibility)
 */
export const clearLegacySession = () => {
  console.log('🧹 Clearing legacy session data...');
  
  localStorage.removeItem('loggedInUser');
  localStorage.removeItem('token');
  localStorage.removeItem('userId');
  
  console.log('✅ Legacy session data cleared');
};

/**
 * Get current session info for debugging
 */
export const getSessionInfo = () => {
  const sessionInfo = {
    customer: {
      user: localStorage.getItem('customer_loggedInUser'),
      token: localStorage.getItem('customer_token'),
      userId: localStorage.getItem('customer_userId')
    },
    staff: {
      user: localStorage.getItem('staff_loggedInUser'),
      token: localStorage.getItem('staff_token'),
      userId: localStorage.getItem('staff_userId')
    },
    legacy: {
      user: localStorage.getItem('loggedInUser'),
      token: localStorage.getItem('token'),
      userId: localStorage.getItem('userId')
    },
    other: {
      isTimeInConfirmed: localStorage.getItem('isTimeInConfirmed'),
      timeIn: localStorage.getItem('timeIn'),
      lastVisitedPage: localStorage.getItem('lastVisitedPage'),
      switchModeTimestamp: localStorage.getItem('switchModeTimestamp')
    }
  };
  
  console.log('📊 Current session info:', sessionInfo);
  return sessionInfo;
};

/**
 * Force logout for staff interface - comprehensive cleanup
 */
export const forceStaffLogout = () => {
  console.log('🚨 FORCE STAFF LOGOUT - Clearing ALL session data');
  
  // Get session info before clearing
  const beforeInfo = getSessionInfo();
  console.log('Session before logout:', beforeInfo);
  
  // Clear all staff-related data
  clearStaffSession();
  
  // Also clear any legacy data that might interfere
  clearLegacySession();
  
  // Clear all other possible keys
  const additionalKeys = [
    'isTimeInConfirmed',
    'timeIn',
    'lastVisitedPage', 
    'switchModeTimestamp'
  ];
  
  additionalKeys.forEach(key => {
    if (localStorage.getItem(key)) {
      console.log(`🗑️ Removing ${key}`);
      localStorage.removeItem(key);
    }
  });
  
  // Clear session storage too
  sessionStorage.clear();
  
  // Verify cleanup
  const afterInfo = getSessionInfo();
  console.log('Session after logout:', afterInfo);
  
  // Force redirect to login
  console.log('🔄 Redirecting to staff login...');
  window.location.href = '/staff-login';
  
  console.log('✅ Force staff logout completed');
};

export default {
  clearAllSessions,
  clearCustomerSession,
  clearStaffSession,
  clearLegacySession,
  getSessionInfo
};
