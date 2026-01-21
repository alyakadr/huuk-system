import axios from "axios";
import api from "../utils/api";
import { getAuthToken } from '../utils/tokenUtils';

const API_BASE_URL = process.env.REACT_APP_API_URL ? `${process.env.REACT_APP_API_URL}/api` : "http://localhost:5000/api";

const client = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
});

const createClientWithTimeout = (timeout) => {
  return axios.create({
    baseURL: API_BASE_URL,
    timeout,
  });
};

client.interceptors.request.use(
  (config) => {
    // Use appropriate token based on endpoint
    const token = localStorage.getItem("token");
    const staffToken = localStorage.getItem("staff_token");
    const customerToken = localStorage.getItem("customer_token");
    
    let selectedToken = null;
    
    // Reduce token selection logging frequency to prevent console spam
    if (Math.random() < 0.05) {
      console.log('[API CLIENT] Token selection for URL:', config.url);
      console.log('[API CLIENT] Available tokens:', {
        staff: staffToken ? '[PRESENT]' : '[MISSING]',
        customer: customerToken ? '[PRESENT]' : '[MISSING]',
        legacy: token ? '[PRESENT]' : '[MISSING]'
      });
    }
    
    // Check current interface based on window location
    const currentPath = window.location.pathname;
    const isStaffInterface = currentPath.includes('/staff') || currentPath.includes('/manager');
    
    if (config.url && (config.url.includes('/customer/') || 
        (config.url.includes('/bookings') && !isStaffInterface))) {
      // For customer endpoints and customer booking endpoints
      selectedToken = customerToken || token;
      // Only log occasionally to reduce console spam
      if (Math.random() < 0.05) {
        console.log('[API CLIENT] Using customer token for:', config.url);
      }
    } else {
      // For staff endpoints, staff bookings, and other protected endpoints
      selectedToken = staffToken || token;
      // Only log occasionally to reduce console spam
      if (Math.random() < 0.05) {
        console.log('[API CLIENT] Using staff token for:', config.url);
      }
    }
    
    if (selectedToken) {
      config.headers.Authorization = `Bearer ${selectedToken}`;
      // Only log occasionally to reduce console spam
      if (Math.random() < 0.05) {
        console.log('[API CLIENT] Authorization header set with token');
      }
    } else {
      console.warn('[API CLIENT] No token available for request to:', config.url);
    }
    return config;
  },
  (error) => Promise.reject(error)
);

client.interceptors.response.use(
  (response) => response,
  (error) => {
    const errorDetails = {
      url: error.config?.url,
      method: error.config?.method,
      status: error.response?.status,
      data: error.response?.data,
      message: error.message,
      code: error.code,
    };
    console.error("API error:", errorDetails);
    if (error.message.includes("timeout")) {
      error.message =
        "Request timed out. Please check your connection or try again.";
    } else if (error.code === "ERR_NETWORK") {
      error.message = "Network error. Please check your internet connection.";
    }
    return Promise.reject(error);
  }
);

// Create a client instance with automatic token refresh
const createApiClientWithTimeout = (timeout) => {
  const clientInstance = axios.create({
    baseURL: API_BASE_URL,
    timeout,
  });
  
  // Add request interceptor
  clientInstance.interceptors.request.use(
    (config) => {
      // Use the getAuthToken utility for more consistent token retrieval
      const token = getAuthToken();
      
      if (token) {
        config.headers["Authorization"] = `Bearer ${token}`;
      }
      return config;
    },
    (error) => Promise.reject(error)
  );
  
  // Add response interceptor with token refresh
  clientInstance.interceptors.response.use(
    (response) => response,
    async (error) => {
      const originalRequest = error.config;
      
      // Handle 401 errors (unauthorized/token expired)
      if (error.response?.status === 401 && !originalRequest._retry) {
        originalRequest._retry = true;
        
        // Determine which token to use based on the URL
        const isCustomerEndpoint = originalRequest.url && (originalRequest.url.includes('/auth/customer/') || originalRequest.url.includes('/customer/') || originalRequest.url.includes('/bookings'));
        const tokenKey = isCustomerEndpoint ? "customer_token" : "staff_token";
        const legacyTokenKey = "token";
        const userKey = isCustomerEndpoint ? "customer_loggedInUser" : "staff_loggedInUser";
        const legacyUserKey = "loggedInUser";
        const userIdKey = isCustomerEndpoint ? "customer_userId" : "staff_userId";
        const legacyUserIdKey = "userId";
        
        const token = localStorage.getItem(tokenKey) || localStorage.getItem(legacyTokenKey);
        if (token) {
          try {
            // Try to refresh the token
            const refreshResponse = await axios.post(`${API_BASE_URL}/auth/refresh`, {}, {
              headers: { Authorization: `Bearer ${token}` }
            });
            
            if (refreshResponse.data.token) {
              // Update both token keys for compatibility
              localStorage.setItem(tokenKey, refreshResponse.data.token);
              localStorage.setItem(legacyTokenKey, refreshResponse.data.token);
              
              // Update user data if provided
              if (refreshResponse.data.user) {
                const currentUser = JSON.parse(localStorage.getItem(userKey) || localStorage.getItem(legacyUserKey) || '{}');
                const updatedUser = { ...currentUser, ...refreshResponse.data.user };
                localStorage.setItem(userKey, JSON.stringify(updatedUser));
                localStorage.setItem(legacyUserKey, JSON.stringify(updatedUser));
              }
              
              originalRequest.headers.Authorization = `Bearer ${refreshResponse.data.token}`;
              return clientInstance(originalRequest);
            }
          } catch (refreshError) {
            console.error("Token refresh failed:", refreshError);
            // If refresh fails, clear storage and redirect to appropriate login
            localStorage.removeItem(userKey);
            localStorage.removeItem(tokenKey);
            localStorage.removeItem(userIdKey);
            localStorage.removeItem(legacyUserKey);
            localStorage.removeItem(legacyTokenKey);
            localStorage.removeItem(legacyUserIdKey);
            window.location.href = isCustomerEndpoint ? "/" : "/staff-login";
          }
        } else {
          // No token available, redirect to appropriate login
          localStorage.removeItem(userKey);
          localStorage.removeItem(tokenKey);
          localStorage.removeItem(userIdKey);
          localStorage.removeItem(legacyUserKey);
          localStorage.removeItem(legacyTokenKey);
          localStorage.removeItem(legacyUserIdKey);
          window.location.href = isCustomerEndpoint ? "/" : "/staff-login";
        }
      }
      
      return Promise.reject(error);
    }
  );
  
  return clientInstance;
};

export const fetchWithRetry = async (
  fn,
  retries = 5,
  delayBase = 2000,
  timeout = 60000
) => {
  for (let i = 0; i < retries; i++) {
    try {
      console.log(`Retry attempt ${i + 1} with timeout ${timeout}ms`);
      const clientInstance = createApiClientWithTimeout(timeout);
      const response = await fn(clientInstance);
      console.log("Request succeeded:", response.data);
      return response;
    } catch (err) {
      if (err.response?.status === 404) {
        console.error("Endpoint not found, skipping retries:", {
          message: err.message,
          code: err.code,
          status: err.response?.status,
          data: err.response?.data,
        });
        throw new Error(
          err.response?.data?.message ||
            err.message ||
            "Request failed due to missing endpoint"
        );
      }
      console.error(`Retry ${i + 1} failed:`, {
        message: err.message,
        code: err.code,
        status: err.response?.status,
        data: err.response?.data,
      });
      if (i === retries - 1 && err.message.includes("timeout")) {
        console.log("Retrying with extended timeout (90s)");
        try {
          const extendedClient = createApiClientWithTimeout(90000);
          const response = await fn(extendedClient);
          console.log(
            "Request succeeded with extended timeout:",
            response.data
          );
          return response;
        } catch (extendedErr) {
          console.error("Extended timeout attempt failed:", {
            message: extendedErr.message,
            code: extendedErr.code,
            status: extendedErr.response?.status,
            data: extendedErr.response?.data,
          });
          throw new Error(
            extendedErr.response?.data?.message ||
              extendedErr.message ||
              "Request failed after retries"
          );
        }
      }
      if (i === retries - 1) {
        throw new Error(
          err.response?.data?.message ||
            err.message ||
            "Request failed after retries"
        );
      }
      const delay = delayBase * (i + 1) * 2;
      console.log(`Retrying after ${delay}ms`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
};

export const setPayAtOutlet = (bookingId, email, userId) =>
  fetchWithRetry(
    (clientInstance) =>
      clientInstance.post("/bookings/set-pay-at-outlet", {
        booking_id: bookingId,
        email,
        user_id: userId // Add the userId to the request
      }),
    5,
    2000,
    60000
  );

export const updatePaymentStatus = (bookingId, status) =>
  fetchWithRetry(
    (clientInstance) =>
      clientInstance.post("/bookings/payments/update-status", {
        booking_id: bookingId,
        status,
      }),
    5,
    2000,
    60000
  );

// New function to update payment status for multiple bookings
export const updateMultipleBookingsPaymentStatus = (bookingIds, status) =>
  fetchWithRetry(
    (clientInstance) =>
      clientInstance.post("/bookings/payments/update-multiple-status", {
        booking_ids: bookingIds,
        status,
      }),
    5,
    2000,
    60000
  );

export const checkPaymentStatusBySession = (sessionId) =>
  fetchWithRetry(
    (clientInstance) =>
      clientInstance.get(`/bookings/payments/status/${sessionId}`),
    5,
    2000,
    60000
  );

export const getUsersList = () => client.get("/users/list");
export const getPendingApprovals = () =>
  client.get("/users/pending-approval");
export const getAttendance = (staff_id, date, page = 1) =>
  client.get("/users/attendance", { params: { staff_id, date, page } });
export const getAllAttendance = (date) =>
  fetchWithRetry(
    (clientInstance) =>
      clientInstance.get("/users/attendance", { params: { date, all: 'true' } }),
    5,
    2000,
    60000
  );

export const getTotalCustomersAll = () => api.get("/customers/total-all");
export const getTotalCustomersUpToYesterday = () =>
  api.get("/customers/total-up-to-yesterday");

export const getAllAppointments = () =>
  fetchWithRetry(
    (clientInstance) =>
      clientInstance.get("/bookings/appointments/all"),
    5,
    2000,
    60000
  );
export const getTotalAppointmentsToday = () =>
  fetchWithRetry(
    (clientInstance) =>
      clientInstance.get("/bookings/appointments/total-today"),
    5,
    2000,
    60000
  );
export const getTotalAppointmentsYesterday = () =>
  fetchWithRetry(
    (clientInstance) =>
      clientInstance.get("/bookings/appointments/total-yesterday"),
    5,
    2000,
    60000
  );
export const deleteBooking = (bookingId) =>
  client.delete(`/bookings/${bookingId}`);

export const getTotalRevenueToday = () =>
  fetchWithRetry(
    (clientInstance) =>
      clientInstance.get("/payments/total-revenue-today"),
    5,
    2000,
    60000
  );
export const getTotalRevenueYesterday = () =>
  fetchWithRetry(
    (clientInstance) =>
      clientInstance.get("/payments/total-revenue-yesterday"),
    5,
    2000,
    60000
  );

// Transaction data for manager dashboard
export const getTodayTransactionsByOutlet = () =>
  fetchWithRetry(
    (clientInstance) =>
      clientInstance.get("/bookings/daily-transactions"),
    5,
    2000,
    60000
  );

// Customer satisfaction ratings for manager dashboard
export const getCustomerSatisfactionRatings = () =>
  fetchWithRetry(
    (clientInstance) =>
      clientInstance.get("/bookings/customer-satisfaction"),
    5,
    2000,
    60000
  );

export const approveStaff = (staffId) =>
  fetchWithRetry(
    (clientInstance) =>
      clientInstance.post(`/users/approve/${staffId}`),
    3,
    1000,
    30000
  );

export default client;
