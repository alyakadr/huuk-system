const jwt = require("jsonwebtoken");
const { attachJwtUserIds } = require("../utils/attachJwtUser");
const { getRawAccessTokenFromRequest } = require("../utils/authCookies");
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error("JWT_SECRET must be set");
}

function verifyToken(req, res, next) {
  const token = getRawAccessTokenFromRequest(req);
  if (!token) {
    return res.status(401).json({ message: "No token provided" });
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (!decoded.userId || !decoded.role) {
      return res.status(401).json({ message: "Invalid token payload" });
    }
    if (!attachJwtUserIds(req, decoded.userId)) {
      return res.status(401).json({ message: "Invalid token payload" });
    }
    req.role = decoded.role;
    next();
  } catch (error) {
    console.error("Token verification failed:", error.message);
    return res.status(401).json({ message: "Invalid or expired token" });
  }
}
module.exports = verifyToken;
