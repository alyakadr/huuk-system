import { getAuthToken } from "./tokenUtils";

/** Options for socket.io-client so the server can join user / staff rooms. */
export function getSocketConnectOptions(extra = {}) {
  const token = getAuthToken();
  return {
    ...extra,
    ...(token ? { auth: { token } } : {}),
  };
}
