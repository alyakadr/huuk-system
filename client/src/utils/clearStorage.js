// Utility to clear all authentication-related storage
export const clearAuthStorage = () => {
  // Clear localStorage
  localStorage.removeItem('staff_loggedInUser');
  localStorage.removeItem('staff_token');
  localStorage.removeItem('staff_userId');
  
  // Clear cookies
  document.cookie = 'email=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
  
  console.log('Authentication storage cleared');
};

// Run this function in browser console if needed
if (typeof window !== 'undefined') {
  window.clearAuthStorage = clearAuthStorage;
}
