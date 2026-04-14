const COOKIE_CUSTOMER =
  process.env.AUTH_COOKIE_CUSTOMER || "huuk_customer_at";
const COOKIE_STAFF = process.env.AUTH_COOKIE_STAFF || "huuk_staff_at";

const baseCookieOptions = () => {
  const secure =
    process.env.COOKIE_SECURE !== undefined
      ? process.env.COOKIE_SECURE === "true"
      : process.env.NODE_ENV === "production";
  const sameSite = process.env.COOKIE_SAMESITE || "lax";
  const opts = {
    httpOnly: true,
    secure,
    sameSite,
    path: "/",
    maxAge: 60 * 60 * 1000,
  };
  if (process.env.COOKIE_DOMAIN) {
    opts.domain = process.env.COOKIE_DOMAIN;
  }
  return opts;
};

const clearCookieOptions = () => ({ ...baseCookieOptions(), maxAge: 0 });

function setCustomerAuthCookie(res, token, maxAgeMs) {
  const opts = { ...baseCookieOptions() };
  if (maxAgeMs != null) {
    opts.maxAge = maxAgeMs;
  }
  res.cookie(COOKIE_CUSTOMER, token, opts);
  res.clearCookie(COOKIE_STAFF, clearCookieOptions());
}

function setStaffAuthCookie(res, token, maxAgeMs) {
  const opts = { ...baseCookieOptions() };
  if (maxAgeMs != null) {
    opts.maxAge = maxAgeMs;
  }
  res.cookie(COOKIE_STAFF, token, opts);
  res.clearCookie(COOKIE_CUSTOMER, clearCookieOptions());
}

function clearAllAuthCookies(res) {
  res.clearCookie(COOKIE_CUSTOMER, clearCookieOptions());
  res.clearCookie(COOKIE_STAFF, clearCookieOptions());
}

/**
 * Raw JWT from Authorization header or mutually-exclusive auth cookies.
 */
function getRawAccessTokenFromRequest(req) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const t = authHeader.split(" ")[1];
    if (t) {
      return t;
    }
  }
  if (!req.cookies) {
    return null;
  }
  return req.cookies[COOKIE_STAFF] || req.cookies[COOKIE_CUSTOMER] || null;
}

function refreshAuthCookieForRole(res, role, token, maxAgeMs) {
  if (role === "customer") {
    setCustomerAuthCookie(res, token, maxAgeMs);
  } else {
    setStaffAuthCookie(res, token, maxAgeMs);
  }
}

module.exports = {
  COOKIE_CUSTOMER,
  COOKIE_STAFF,
  setCustomerAuthCookie,
  setStaffAuthCookie,
  clearAllAuthCookies,
  getRawAccessTokenFromRequest,
  refreshAuthCookieForRole,
};
