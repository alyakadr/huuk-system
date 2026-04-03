import http from "../utils/httpClient";
import api from "../utils/api";
import { getAuthToken } from "../utils/tokenUtils";
import { withRetry } from "../utils/retry";
import { normalizeApiError } from "../utils/normalizeApiError";

const API_BASE_URL = process.env.REACT_APP_API_URL
  ? `${process.env.REACT_APP_API_URL}/api`
  : "http://localhost:5000/api";

const client = http.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
});

client.interceptors.request.use(
  (config) => {
    // Use appropriate token based on endpoint
    const token = localStorage.getItem("token");
    const staffToken = localStorage.getItem("staff_token");
    const customerToken = localStorage.getItem("customer_token");

    let selectedToken = null;

    // Check current interface based on window location
    const currentPath = window.location.pathname;
    const isStaffInterface =
      currentPath.includes("/staff") || currentPath.includes("/manager");

    // For manager dashboard endpoints, always use staff token
    if (
      config.url &&
      (config.url.includes("/bookings/appointments/all") ||
        config.url.includes("/payments/total-revenue") ||
        config.url.includes("/bookings/appointments/total") ||
        config.url.includes("/bookings/daily-transactions") ||
        config.url.includes("/bookings/customer-satisfaction"))
    ) {
      selectedToken = staffToken || token;
    } else if (
      config.url &&
      (config.url.includes("/customer/") ||
        (config.url.includes("/bookings") && !isStaffInterface))
    ) {
      // For customer endpoints and customer booking endpoints
      selectedToken = customerToken || token;
    } else {
      // For staff endpoints, staff bookings, and other protected endpoints
      selectedToken = staffToken || token;
    }

    // IMPORTANT: For booking endpoints, check interface context
    if (config.url && config.url.includes("/bookings")) {
      if (isStaffInterface) {
        selectedToken = staffToken || token;
      } else {
        selectedToken = customerToken || token;
      }
    }

    if (selectedToken) {
      config.headers.Authorization = `Bearer ${selectedToken}`;
    } else {
      console.warn("[API] No token available for request to:", config.url);
    }
    return config;
  },
  (error) => Promise.reject(error),
);

client.interceptors.response.use(
  (response) => response,
  (error) => {
    const errorDetails = normalizeApiError(error, "API request failed");
    console.error("API error:", errorDetails);
    if (errorDetails.isTimeout) {
      error.message =
        "Request timed out. Please check your connection or try again.";
    } else if (errorDetails.isNetworkError) {
      error.message = "Network error. Please check your internet connection.";
    }
    return Promise.reject(error);
  },
);

// Create a client instance with automatic token refresh
const createApiClientWithTimeout = (timeout) => {
  const clientInstance = http.create({
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
    (error) => Promise.reject(error),
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
        const isCustomerEndpoint =
          originalRequest.url &&
          (originalRequest.url.includes("/auth/customer/") ||
            originalRequest.url.includes("/customer/") ||
            originalRequest.url.includes("/bookings"));
        const tokenKey = isCustomerEndpoint ? "customer_token" : "staff_token";
        const legacyTokenKey = "token";
        const userKey = isCustomerEndpoint
          ? "customer_loggedInUser"
          : "staff_loggedInUser";
        const legacyUserKey = "loggedInUser";
        const userIdKey = isCustomerEndpoint
          ? "customer_userId"
          : "staff_userId";
        const legacyUserIdKey = "userId";

        const token =
          localStorage.getItem(tokenKey) ||
          localStorage.getItem(legacyTokenKey);
        if (token) {
          try {
            // Try to refresh the token
            const refreshResponse = await http.post(
              `${API_BASE_URL}/auth/refresh`,
              {},
              {
                headers: { Authorization: `Bearer ${token}` },
              },
            );

            if (refreshResponse.data.token) {
              // Update both token keys for compatibility
              localStorage.setItem(tokenKey, refreshResponse.data.token);
              localStorage.setItem(legacyTokenKey, refreshResponse.data.token);

              // Update user data if provided
              if (refreshResponse.data.user) {
                const currentUser = JSON.parse(
                  localStorage.getItem(userKey) ||
                    localStorage.getItem(legacyUserKey) ||
                    "{}",
                );
                const updatedUser = {
                  ...currentUser,
                  ...refreshResponse.data.user,
                };
                localStorage.setItem(userKey, JSON.stringify(updatedUser));
                localStorage.setItem(
                  legacyUserKey,
                  JSON.stringify(updatedUser),
                );
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
    },
  );

  return clientInstance;
};

export const fetchWithRetry = async (
  fn,
  retries = 5,
  delayBase = 2000,
  timeout = 60000,
) => {
  try {
    return await withRetry(
      async () => {
        const clientInstance = createApiClientWithTimeout(timeout);
        return fn(clientInstance);
      },
      {
        retries,
        delayBase,
        shouldRetry: (error) => error?.response?.status !== 404,
      },
    );
  } catch (error) {
    const normalizedError = normalizeApiError(
      error,
      "Request failed after retries",
    );

    if (normalizedError.status === 404) {
      throw new Error(
        normalizedError.message || "Request failed due to missing endpoint",
      );
    }

    if (normalizedError.isTimeout) {
      try {
        const extendedClient = createApiClientWithTimeout(90000);
        return await fn(extendedClient);
      } catch (extendedError) {
        const normalizedExtended = normalizeApiError(
          extendedError,
          "Request failed after retries",
        );
        throw new Error(
          normalizedExtended.message || "Request failed after retries",
        );
      }
    }

    throw new Error(normalizedError.message || "Request failed after retries");
  }
};

export const setPayAtOutlet = (bookingId, email, userId) =>
  fetchWithRetry(
    (clientInstance) =>
      clientInstance.post("/bookings/set-pay-at-outlet", {
        booking_id: bookingId,
        email,
        user_id: userId, // Add the userId to the request
        debug: true, // Add debug flag to help diagnose verification issues
      }),
    5,
    2000,
    60000,
  );

// New function to set Pay at Outlet for multiple bookings
export const setMultiplePayAtOutlet = (bookingIds, email, userId) =>
  fetchWithRetry(
    (clientInstance) =>
      clientInstance.post("/bookings/set-multiple-pay-at-outlet", {
        booking_ids: bookingIds,
        email,
        user_id: userId,
        debug: true,
      }),
    5,
    2000,
    60000,
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
    60000,
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
    60000,
  );

export const checkPaymentStatusBySession = (sessionId) =>
  fetchWithRetry(
    (clientInstance) =>
      clientInstance.get(`/bookings/payments/status/${sessionId}`),
    5,
    2000,
    60000,
  );

export const getUsersList = () => client.get("/users/list");
export const getPendingApprovals = () => client.get("/users/pending-approval");
export const getAttendance = (staff_id, date, page = 1) =>
  client.get("/users/attendance", { params: { staff_id, date, page } });
export const getAllAttendance = (date) =>
  fetchWithRetry(
    (clientInstance) =>
      clientInstance.get("/users/attendance", {
        params: { date, all: "true" },
      }),
    5,
    2000,
    60000,
  );

export const getTotalCustomersAll = () => api.get("/customers/total-all");
export const getTotalCustomersUpToYesterday = () =>
  api.get("/customers/total-up-to-yesterday");

export const getAllAppointments = () =>
  fetchWithRetry(
    (clientInstance) => clientInstance.get("/bookings/appointments/all"),
    5,
    2000,
    60000,
  );
export const getTotalAppointmentsToday = () =>
  fetchWithRetry(
    (clientInstance) =>
      clientInstance.get("/bookings/appointments/total-today"),
    5,
    2000,
    60000,
  );
export const getTotalAppointmentsYesterday = () =>
  fetchWithRetry(
    (clientInstance) =>
      clientInstance.get("/bookings/appointments/total-yesterday"),
    5,
    2000,
    60000,
  );
export const deleteBooking = (bookingId) =>
  client.delete(`/bookings/${bookingId}`);

export const getTotalRevenueToday = () =>
  fetchWithRetry(
    (clientInstance) => clientInstance.get("/payments/total-revenue-today"),
    5,
    2000,
    60000,
  );
export const getTotalRevenueYesterday = () =>
  fetchWithRetry(
    (clientInstance) => clientInstance.get("/payments/total-revenue-yesterday"),
    5,
    2000,
    60000,
  );

// Transaction data for manager dashboard
export const getTodayTransactionsByOutlet = () =>
  fetchWithRetry(
    (clientInstance) => clientInstance.get("/bookings/daily-transactions"),
    5,
    2000,
    60000,
  );

// Customer satisfaction ratings for manager dashboard
export const getCustomerSatisfactionRatings = () =>
  fetchWithRetry(
    (clientInstance) => clientInstance.get("/bookings/customer-satisfaction"),
    5,
    2000,
    60000,
  );

export const approveStaff = (staffId) =>
  fetchWithRetry(
    (clientInstance) => clientInstance.post(`/users/approve/${staffId}`),
    3,
    1000,
    30000,
  );

export default client;
