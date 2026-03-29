import { useCallback, useMemo } from "react";

const INTERFACE_ROLE = {
  STAFF: "staff",
  CUSTOMER: "customer",
};

const STAFF_PATH_SEGMENTS = ["/staff", "/manager"];

const parseStorageJson = (key) => {
  const rawValue = localStorage.getItem(key);
  if (!rawValue) {
    return null;
  }

  try {
    return JSON.parse(rawValue);
  } catch (error) {
    console.error(`Failed to parse localStorage value for ${key}:`, error);
    return null;
  }
};

const resolveInterfaceRole = () => {
  const currentPath = window.location.pathname;
  const isStaffInterface = STAFF_PATH_SEGMENTS.some((segment) =>
    currentPath.includes(segment),
  );

  return isStaffInterface ? INTERFACE_ROLE.STAFF : INTERFACE_ROLE.CUSTOMER;
};

const getSessionByRole = (role) => {
  if (role === INTERFACE_ROLE.STAFF) {
    const token =
      localStorage.getItem("staff_token") || localStorage.getItem("token");
    const user =
      parseStorageJson("staff_loggedInUser") ||
      parseStorageJson("loggedInUser");

    return { token, user, role };
  }

  const token =
    localStorage.getItem("customer_token") || localStorage.getItem("token");
  const user =
    parseStorageJson("customer_loggedInUser") ||
    parseStorageJson("loggedInUser");

  return { token, user, role };
};

export const useAuthSession = (preferredRole) => {
  const resolvedRole = preferredRole || resolveInterfaceRole();

  const session = useMemo(() => getSessionByRole(resolvedRole), [resolvedRole]);

  const clearSession = useCallback(() => {
    if (resolvedRole === INTERFACE_ROLE.STAFF) {
      localStorage.removeItem("staff_token");
      localStorage.removeItem("staff_loggedInUser");
      localStorage.removeItem("staff_userId");
      return;
    }

    localStorage.removeItem("customer_token");
    localStorage.removeItem("customer_loggedInUser");
    localStorage.removeItem("customer_userId");
  }, [resolvedRole]);

  const authHeaders = useMemo(() => {
    if (!session.token) {
      return {};
    }

    return { Authorization: `Bearer ${session.token}` };
  }, [session.token]);

  return {
    token: session.token,
    user: session.user,
    role: session.role,
    isAuthenticated: Boolean(session.token && session.user?.id),
    authHeaders,
    clearSession,
  };
};

export { INTERFACE_ROLE };
