const jwt = require("jsonwebtoken");
const { refreshAuthCookieForRole, setRefreshCookieForRole } = require("./authCookies");
const { issueRefreshToken } = require("./refreshTokenService");

/**
 * Sets httpOnly access + refresh cookies and persists a rotated refresh token.
 * @param {import("express").Response} res
 * @param {{ _id: import("mongoose").Types.ObjectId, role: string }} userLean
 * @param {Record<string, unknown>} jwtPayload
 * @param {string} [accessExpiresIn]
 * @returns {Promise<string>} access JWT (for JSON body when needed)
 */
async function setAccessAndRefreshCookiesForUser(
  res,
  userLean,
  jwtPayload,
  accessExpiresIn = "1h",
) {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET is not set");
  }
  const accessToken = jwt.sign(jwtPayload, secret, {
    expiresIn: accessExpiresIn,
  });
  refreshAuthCookieForRole(res, userLean.role, accessToken);
  const { raw } = await issueRefreshToken(userLean._id);
  setRefreshCookieForRole(res, userLean.role, raw);
  return accessToken;
}

module.exports = { setAccessAndRefreshCookiesForUser };
