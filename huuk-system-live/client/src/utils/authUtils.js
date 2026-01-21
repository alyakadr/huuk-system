import { jwtDecode } from "jwt-decode";

export const restrictToRoles = (allowedRoles, navigate) => {
  const storedUser = localStorage.getItem("staff_loggedInUser");
  if (!storedUser) {
    navigate("/staff-login");
    return false;
  }
  let user;
  try {
    user = JSON.parse(storedUser);
    if (!allowedRoles.includes(user.role)) {
      navigate("/login");
      return false;
    }
  } catch (error) {
    navigate("/staff-login");
    return false;
  }
  const token = localStorage.getItem("staff_token");
  if (!token) {
    navigate("/staff-login");
    return false;
  }
  try {
    const decoded = jwtDecode(token);
    if (String(user.id) !== String(decoded.userId)) {
      navigate("/staff-login");
      return false;
    }
    return true;
  } catch (error) {
    navigate("/staff-login");
    return false;
  }
};

export const restrictToCustomer = (navigate) => {
  return restrictToRoles(["customer"], navigate);
};
