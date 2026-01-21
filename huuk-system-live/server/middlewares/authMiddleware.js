const jwt = require("jsonwebtoken");
const JWT_SECRET = process.env.JWT_SECRET || "your_jwt_secret_key";

if (!JWT_SECRET || JWT_SECRET === "your_jwt_secret_key") {
  console.warn("[AUTH] Using default JWT_SECRET. Set JWT_SECRET environment variable for security!");
}

function verifyToken(req, res, next) {
  const authHeader = req.headers.authorization;
  console.log("All headers:", req.headers); // Log all headers
  console.log("Authorization header:", authHeader);
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    console.log("No token provided or invalid format");
    return res.status(401).json({ message: "No token provided" });
  }
  const token = authHeader.split(" ")[1];
  console.log("Token extracted:", token);
  if (!token) {
    console.log("No token found after split");
    return res.status(401).json({ message: "No token provided" });
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    console.log("Decoded token:", decoded);
    if (!decoded.userId || !decoded.role) {
      console.log("Invalid token payload, missing userId or role");
      return res.status(401).json({ message: "Invalid token payload" });
    }
    req.userId = decoded.userId;
    req.role = decoded.role;
    console.log("User role from token:", req.role, "User ID:", req.userId);
    next();
  } catch (error) {
    console.error("Token verification error:", error);
    return res.status(401).json({ message: "Invalid or expired token" });
  }
}
module.exports = verifyToken;
