import axios from "axios";

const API_BASE_URL = process.env.REACT_APP_API_URL ? `${process.env.REACT_APP_API_URL}/api` : "http://localhost:5000/api";

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
});

api.interceptors.request.use(
  (config) => {
    // Check for both staff and customer tokens
    const staffToken = localStorage.getItem("staff_token");
    const legacyToken = localStorage.getItem("token");
    const customerToken = localStorage.getItem("customer_token");
    
    // Enhanced logging for booking operations
    if (config.url && config.url.includes('/bookings')) {
      console.log("[API] Booking request interceptor:", {
        url: config.url,
        method: config.method,
        hasStaffToken: !!staffToken,
        hasLegacyToken: !!legacyToken,
        hasCustomerToken: !!customerToken,
        staffTokenLength: staffToken ? staffToken.length : 0,
        legacyTokenLength: legacyToken ? legacyToken.length : 0,
        customerTokenLength: customerToken ? customerToken.length : 0,
        timestamp: new Date().toISOString()
      });
    }
    
    // Use appropriate token based on endpoint
    let token = null;
    if (config.url && config.url.includes('/auth/customer/')) {
      token = customerToken;
    } else if (config.url && (config.url.includes('/auth/staff/') || config.url.includes('/users/') || config.url.includes('/bookings/') || config.url.includes('/customers/'))) {
      token = staffToken || legacyToken;
    } else {
      // Default: try staff token first, then legacy token, then customer token
      token = staffToken || legacyToken || customerToken;
    }
    
    // Enhanced token selection logging for booking operations
    if (config.url && config.url.includes('/bookings')) {
      console.log("[API] Token selection for booking:", {
        selectedTokenType: token === staffToken ? 'staff' : 
                          token === legacyToken ? 'legacy' : 
                          token === customerToken ? 'customer' : 'none',
        tokenExists: !!token,
        tokenLength: token ? token.length : 0,
        authHeaderWillBeSet: !!token
      });
    }
    
    // Add debug log for every request
    console.log('[API] Request:', config.url, 'Token:', token);

    if (token) {
      config.headers["Authorization"] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => {
    // Enhanced logging for booking operations responses
    if (response.config?.url && response.config.url.includes('/bookings')) {
      console.log("[API] Booking response interceptor (SUCCESS):", {
        url: response.config.url,
        method: response.config.method,
        status: response.status,
        responseDataKeys: response.data ? Object.keys(response.data) : [],
        hasData: !!response.data,
        timestamp: new Date().toISOString()
      });
    }
    return response;
  },
  async (error) => {
    const originalRequest = error.config;
    
    // Enhanced logging for booking-related errors
    if (error.config?.url && error.config.url.includes('/bookings')) {
      console.error("[API] Booking response interceptor (ERROR):", {
        url: error.config?.url,
        method: error.config?.method,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        message: error.message,
        requestHeaders: error.config?.headers,
        requestData: error.config?.data,
        timestamp: new Date().toISOString(),
        errorType: error.response ? 'HTTP_ERROR' : 'NETWORK_ERROR'
      });
      
      // Special handling for 400 Bad Request
      if (error.response?.status === 400) {
        console.error("[API] 400 Bad Request Details:", {
          validationErrors: error.response?.data?.errors,
          message: error.response?.data?.message,
          field: error.response?.data?.field,
          details: error.response?.data?.details,
          fullResponseData: error.response?.data
        });
      }
    }
    
    console.error("API error:", {
      url: error.config?.url,
      status: error.response?.status,
      data: error.response?.data,
      message: error.message,
    });
    
    // Handle 401 errors (unauthorized/token expired)
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      // Determine which token to use based on the URL
      const isCustomerEndpoint = originalRequest.url && originalRequest.url.includes('/auth/customer/');
      const tokenKey = isCustomerEndpoint ? "customer_token" : "staff_token";
      const userKey = isCustomerEndpoint ? "customer_loggedInUser" : "staff_loggedInUser";
      const userIdKey = isCustomerEndpoint ? "customer_userId" : "staff_userId";
      
      const token = localStorage.getItem(tokenKey);
      if (token) {
        try {
          // Try to refresh the token
          const refreshResponse = await axios.post(`${API_BASE_URL}/auth/refresh`, {}, {
            headers: { Authorization: `Bearer ${token}` }
          });
          
          if (refreshResponse.data.token) {
            localStorage.setItem(tokenKey, refreshResponse.data.token);
            originalRequest.headers.Authorization = `Bearer ${refreshResponse.data.token}`;
            return api(originalRequest);
          }
        } catch (refreshError) {
          console.error("Token refresh failed:", refreshError);
          // If refresh fails, clear storage and redirect to clean login interface
          localStorage.removeItem(userKey);
          localStorage.removeItem(tokenKey);
          localStorage.removeItem(userIdKey);
          window.location.href = isCustomerEndpoint ? "/" : "/staff-login?sessionExpired=true";
        }
      } else {
        // No token available, redirect to clean login interface
        localStorage.removeItem(userKey);
        localStorage.removeItem(tokenKey);
        localStorage.removeItem(userIdKey);
        window.location.href = isCustomerEndpoint ? "/" : "/staff-login?sessionExpired=true";
      }
    }
    
    return Promise.reject(error);
  }
);

// Booking-related API functions
export const fetchBookingsByPhone = async (phoneNumber) => {
  try {
    const response = await api.get(`/bookings/by-phone/${encodeURIComponent(phoneNumber)}`);
    return {
      bookings: response.data || []
    };
  } catch (error) {
    console.error('Error fetching bookings by phone:', error);
    throw error;
  }
};

export default api;
