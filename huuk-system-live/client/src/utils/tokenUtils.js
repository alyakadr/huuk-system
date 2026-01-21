// Token migration utilities
export const getAuthToken = () => {
  return localStorage.getItem("customer_token") || localStorage.getItem("staff_token") || localStorage.getItem("token");
};

export const getUserData = () => {
  const userJson = localStorage.getItem("customer_loggedInUser") || localStorage.getItem("staff_loggedInUser") || localStorage.getItem("loggedInUser");
  if (!userJson) return null;
  
  try {
    return JSON.parse(userJson);
  } catch (error) {
    console.error("Error parsing user data:", error);
    return null;
  }
};

export const getUserId = () => {
  const userData = getUserData();
  return userData?.id || null;
};

export const migrateTokens = () => {
  const token = localStorage.getItem("token");
  const user = localStorage.getItem("loggedInUser");
  
  if (token && !localStorage.getItem("staff_token")) {
    localStorage.setItem("staff_token", token);
    console.log("🔄 Token migrated to staff_token");
  }
  
  if (user && !localStorage.getItem("staff_loggedInUser")) {
    localStorage.setItem("staff_loggedInUser", user);
    console.log("🔄 User data migrated to staff_loggedInUser");
  }
};

export const clearAuthData = () => {
  localStorage.removeItem("token");
  localStorage.removeItem("staff_token");
  localStorage.removeItem("customer_token");
  localStorage.removeItem("loggedInUser");
  localStorage.removeItem("staff_loggedInUser");
  localStorage.removeItem("customer_loggedInUser");
  localStorage.removeItem("userId");
  localStorage.removeItem("staff_userId");
  localStorage.removeItem("customer_userId");
  localStorage.removeItem("isTimeInConfirmed");
  localStorage.removeItem("timeIn");
};

export const isAuthenticated = () => {
  const token = getAuthToken();
  const userData = getUserData();
  return !!(token && userData && userData.id);
};

export const getAuthHeaders = () => {
  const token = getAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};
