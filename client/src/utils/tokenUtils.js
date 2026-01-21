// Token migration utilities
export const getAuthToken = () => {
  const customerToken = localStorage.getItem("customer_token");
  const staffToken = localStorage.getItem("staff_token");
  const legacyToken = localStorage.getItem("token");
  
  // Check if we're on a staff/manager page
  const currentPath = window.location.pathname;
  const isStaffInterface = currentPath.includes('/staff') || currentPath.includes('/manager');
  
  // Determine which token to use based on context
  let finalToken;
  
  if (isStaffInterface) {
    // On staff/manager pages, prioritize staff token
    finalToken = staffToken || legacyToken;
  } else {
    // On customer pages, prioritize customer token
    finalToken = customerToken || legacyToken || staffToken;
  }
  
  console.log("🔑 [TOKEN DEBUG] Available tokens:", {
    customerToken: customerToken ? `${customerToken.substring(0, 10)}...` : "null",
    staffToken: staffToken ? `${staffToken.substring(0, 10)}...` : "null",
    legacyToken: legacyToken ? `${legacyToken.substring(0, 10)}...` : "null",
    isStaffInterface
  });
  
  console.log("🔑 [TOKEN DEBUG] Using token:", finalToken ? `${finalToken.substring(0, 10)}...` : "null");
  
  return finalToken;
};

export const getUserData = () => {
  const customerUserJson = localStorage.getItem("customer_loggedInUser");
  const staffUserJson = localStorage.getItem("staff_loggedInUser");
  const legacyUserJson = localStorage.getItem("loggedInUser");
  
  console.log("👤 [USER DATA DEBUG] Available user data:", {
    customerUserJson: customerUserJson ? "present" : "null",
    staffUserJson: staffUserJson ? "present" : "null",
    legacyUserJson: legacyUserJson ? "present" : "null"
  });
  
  const userJson = customerUserJson || staffUserJson || legacyUserJson;
  
  if (!userJson) {
    console.log("👤 [USER DATA DEBUG] No user data found!");
    return null;
  }
  
  try {
    const userData = JSON.parse(userJson);
    console.log("👤 [USER DATA DEBUG] Parsed user data:", {
      id: userData?.id || "missing",
      role: userData?.role || "missing",
      email: userData?.email ? "present" : "missing"
    });
    return userData;
  } catch (error) {
    console.error("❌ [USER DATA DEBUG] Error parsing user data:", error);
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

// Add a function to ensure staff token is available for manager dashboard
export const ensureStaffToken = () => {
  const staffToken = localStorage.getItem("staff_token");
  const legacyToken = localStorage.getItem("token");
  
  if (!staffToken && legacyToken) {
    localStorage.setItem("staff_token", legacyToken);
    console.log("🔄 Migrated legacy token to staff_token");
    return legacyToken;
  }
  
  return staffToken || legacyToken;
};
