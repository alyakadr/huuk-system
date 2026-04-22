import http from "./httpClient";
import { normalizeApiError } from "./normalizeApiError";

const API_BASE_URL = process.env.REACT_APP_API_URL
  ? `${process.env.REACT_APP_API_URL}/api`
  : "http://localhost:5000/api";

const api = http.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
});

api.interceptors.request.use(
  (config) => {
    if (!config.headers) config.headers = {};
    // Check for both staff and customer tokens
    const staffToken = localStorage.getItem("staff_token");
    const legacyToken = localStorage.getItem("token");
    const customerToken = localStorage.getItem("customer_token");

    // Check current interface based on window location
    const currentPath = window.location.pathname;
    const isStaffInterface =
      currentPath.includes("/staff") || currentPath.includes("/manager");

    // Use appropriate token based on endpoint
    let token = null;

    // For manager dashboard endpoints, always use staff token
    if (
      config.url &&
      (config.url.includes("/bookings/appointments/all") ||
        config.url.includes("/payments/total-revenue") ||
        config.url.includes("/bookings/appointments/total") ||
        config.url.includes("/bookings/daily-transactions") ||
        config.url.includes("/bookings/customer-satisfaction"))
    ) {
      token = staffToken || legacyToken;
    } else if (config.url && config.url.includes("/auth/customer/")) {
      token = customerToken;
    } else if (
      config.url &&
      (config.url.includes("/auth/staff/") ||
        config.url.includes("/users/") ||
        config.url.includes("/customers/"))
    ) {
      token = staffToken || legacyToken;
    } else if (config.url && config.url.includes("/bookings/")) {
      // For booking endpoints, check interface context
      if (isStaffInterface) {
        token = staffToken || legacyToken;
      } else {
        token = customerToken || legacyToken;
      }
    } else {
      // Default: try staff token first, then legacy token, then customer token
      token = staffToken || legacyToken || customerToken;
    }

    if (token) {
      config.headers["Authorization"] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const normalizedError = normalizeApiError(error, "API request failed");

    console.error("API error:", normalizedError);

    // Handle 401 errors (unauthorized/token expired)
    if (normalizedError.isUnauthorized && !originalRequest._retry) {
      originalRequest._retry = true;

      const currentPath = window.location.pathname;
      const isStaffInterface =
        currentPath.includes("/staff") || currentPath.includes("/manager");
      const tokenKey = isStaffInterface ? "staff_token" : "customer_token";
      const userKey = isStaffInterface
        ? "staff_loggedInUser"
        : "customer_loggedInUser";
      const userIdKey = isStaffInterface ? "staff_userId" : "customer_userId";

      const token = localStorage.getItem(tokenKey);
      const hasStoredUser = localStorage.getItem(userKey);

      if (token || hasStoredUser) {
        try {
          const refreshHeaders = token
            ? { Authorization: `Bearer ${token}` }
            : {};
          const refreshResponse = await http.post(
            `${API_BASE_URL}/auth/refresh`,
            {},
            {
              headers: refreshHeaders,
            },
          );

          if (!originalRequest.headers) originalRequest.headers = {};

          if (refreshResponse.data.token) {
            localStorage.setItem(tokenKey, refreshResponse.data.token);
            originalRequest.headers.Authorization = `Bearer ${refreshResponse.data.token}`;
            return api(originalRequest);
          }
          if (refreshResponse.data.success) {
            delete originalRequest.headers.Authorization;
            return api(originalRequest);
          }
        } catch (refreshError) {
          console.error("Token refresh failed:", refreshError);
          localStorage.removeItem(userKey);
          localStorage.removeItem(tokenKey);
          localStorage.removeItem(userIdKey);
          window.location.href = isStaffInterface
            ? "/staff-login?sessionExpired=true"
            : "/";
        }
      } else {
        localStorage.removeItem(userKey);
        localStorage.removeItem(tokenKey);
        localStorage.removeItem(userIdKey);
        window.location.href = isStaffInterface
          ? "/staff-login?sessionExpired=true"
          : "/";
      }
    }

    return Promise.reject(error);
  },
);

// Booking-related API functions
export const fetchBookingsByPhone = async (phoneNumber) => {
  try {
    const response = await api.get(
      `/bookings/by-phone/${encodeURIComponent(phoneNumber)}`,
    );
    return {
      bookings: response.data || [],
    };
  } catch (error) {
    console.error("Error fetching bookings by phone:", error);
    throw error;
  }
};

export default api;
