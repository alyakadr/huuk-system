export const normalizeApiError = (
  error,
  fallbackMessage = "Request failed",
) => {
  const response = error?.response;
  const config = error?.config || {};

  const status = response?.status ?? null;
  const data = response?.data;
  const code = error?.code || null;
  const message = data?.message || error?.message || fallbackMessage;

  const isTimeout =
    code === "ECONNABORTED" ||
    String(message).toLowerCase().includes("timeout");
  const isNetworkError = code === "ERR_NETWORK" || (!response && !status);

  return {
    message,
    status,
    code,
    data,
    url: config?.url || null,
    method: config?.method || null,
    isTimeout,
    isNetworkError,
    isUnauthorized: status === 401,
  };
};

export const toUserMessage = (
  error,
  fallbackMessage = "Something went wrong. Please try again.",
) => {
  const normalized = normalizeApiError(error, fallbackMessage);

  if (normalized.isTimeout) {
    return "Request timed out. Please check your connection and try again.";
  }

  if (normalized.isNetworkError) {
    return "Network error. Please check your internet connection.";
  }

  return normalized.message || fallbackMessage;
};
