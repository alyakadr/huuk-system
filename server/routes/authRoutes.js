const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error("JWT_SECRET is not set in environment variables");
  process.exit(1);
}

// Helper function to handle sign-in logic
const handleSignIn = async (req, res, allowedRoles) => {
  if (!req.body) {
    return res.status(400).json({ message: "Request body is missing" });
  }

  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: "Email and password required" });
  }

  try {
    const user = await User.findOne({ email: email.toLowerCase() }).lean();

    if (!user) {
      console.log(`[Auth Failure] Reason: User not found for email: ${email.toLowerCase()}`);
      return res.status(401).json({ message: "Invalid email or password" });
    }

    if (!allowedRoles.includes(user.role)) {
      console.log(
        `[Auth Failure] Reason: Role not allowed. User role: '${user.role}', Allowed roles: '${allowedRoles.join(", ")}'`
      );
      return res.status(403).json({
        message: `Access restricted to ${allowedRoles.join(" or ")} only`,
      });
    }

    if (user.isApproved === 0) {
      console.log(`[Auth Failure] Reason: User account not approved for email: ${email.toLowerCase()}`);
      return res.status(403).json({ message: "Account pending approval by manager" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      console.log(`[Auth Failure] Reason: Incorrect password for email: ${email.toLowerCase()}`);
      return res.status(401).json({ message: "Invalid email or password" });
    }

    console.log(`Sign-in successful for user: ${user._id} (${user.email}) with role: ${user.role}`);

    const payload = {
      userId: user._id.toString(),
      role: user.role,
      email: user.email,
    };

    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: "1h" });

    res.status(200).json({
      success: true,
      user: {
        id: user._id.toString(),
        fullname: user.fullname,
        username: user.username,
        email: user.email,
        role: user.role,
        outlet: user.outlet,
        profile_picture: user.profile_picture || "/Uploads/profile_pictures/default.jpg",
      },
      token,
    });
  } catch (err) {
    console.error("Database error:", err.message);
    return res.status(500).json({ message: "Server error" });
  }
};

// Customer Sign-In route (phone-based)
router.post("/customer/signin", async (req, res) => {
  if (!req.body) {
    return res.status(400).json({ message: "Request body is missing" });
  }

  const { phone_number, password } = req.body;

  if (!phone_number || !password) {
    return res.status(400).json({ message: "Phone number and password required" });
  }

  try {
    const user = await User.findOne({ phone_number, role: "customer" }).lean();

    if (!user) {
      console.log(`Sign-in failed: No customer found with phone: ${phone_number}`);
      return res.status(401).json({ message: "Invalid phone number or password" });
    }

    if (user.isApproved === 0) {
      return res.status(403).json({ message: "Account pending approval by manager" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      console.log(`Sign-in failed: Wrong password for phone: ${phone_number}`);
      return res.status(401).json({ message: "Invalid phone number or password" });
    }

    console.log(`Sign-in successful for user: ${user._id} (${user.phone_number}) with role: ${user.role}`);

    const payload = {
      userId: user._id.toString(),
      role: user.role,
      phone_number: user.phone_number,
    };

    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: "1h" });

    res.status(200).json({
      success: true,
      user: {
        id: user._id.toString(),
        fullname: user.fullname,
        username: user.username,
        phone_number: user.phone_number,
        role: user.role,
        outlet: user.outlet,
        profile_picture: user.profile_picture || "/Uploads/profile_pictures/default.jpg",
      },
      token,
    });
  } catch (err) {
    console.error("Database error:", err.message);
    return res.status(500).json({ message: "Server error" });
  }
});

// Staff/Manager Sign-In route
router.post("/staff/signin", (req, res) => {
  handleSignIn(req, res, ["staff", "manager"]);
});

// Staff/Manager Signup route
router.post("/signup", async (req, res) => {
  if (!req.body) {
    return res.status(400).json({ message: "Request body is missing" });
  }

  const { email, password, fullname, username, userType, outlet } = req.body;

  if (!email || !password || !fullname || !username || !userType) {
    return res.status(400).json({ message: "Please fill all required fields." });
  }

  const allowedRoles = ["staff", "manager"];
  if (!allowedRoles.includes(userType)) {
    return res.status(400).json({ message: "Invalid user type. Must be 'staff' or 'manager'." });
  }

  try {
    const emailLower = email.toLowerCase();

    const emailCount = await User.countDocuments({ email: emailLower });
    if (emailCount > 0) {
      return res.status(400).json({ message: "Email is already registered." });
    }

    const usernameCount = await User.countDocuments({ username });
    if (usernameCount > 0) {
      return res.status(400).json({ message: "Username is already taken." });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await User.create({
      email: emailLower,
      password: hashedPassword,
      fullname,
      username,
      role: userType,
      outlet: outlet || null,
      isApproved: 0,
      status: "pending",
    });

    const newUser = {
      id: result._id.toString(),
      fullname: result.fullname,
      username: result.username,
      email: result.email,
      outlet: result.outlet,
      createdAt: result.createdAt,
      status: "pending",
    };

    const io = req.app.get("socketio");
    if (io) {
      io.emit("pendingStaffUpdate", { action: "add", user: newUser });
    }

    return res.json({ message: "User registered successfully" });
  } catch (err) {
    console.error("Signup error:", err.message);
    return res.status(500).json({ message: "Server error during signup", error: err.message });
  }
});

// Customer Signup route
router.post("/customer/signup", async (req, res) => {
  console.log("[CUSTOMER SIGNUP] Request received:", {
    body: req.body,
    timestamp: new Date().toISOString(),
  });

  if (!req.body) {
    console.log("[CUSTOMER SIGNUP] Error: Request body is missing");
    return res.status(400).json({ message: "Request body is missing" });
  }

  const { phone_number, password, email, username } = req.body;
  console.log("[CUSTOMER SIGNUP] Extracted fields:", {
    phone_number,
    password: password ? "[PROVIDED]" : "[MISSING]",
    email,
    username,
  });

  if (!phone_number || !password || !email || !username) {
    return res.status(400).json({ message: "Please fill all required fields." });
  }

  try {
    const phoneCount = await User.countDocuments({ phone_number });
    if (phoneCount > 0) {
      return res.status(400).json({ message: "Phone number is already registered." });
    }

    const emailCount = await User.countDocuments({ email: email.toLowerCase() });
    if (emailCount > 0) {
      return res.status(400).json({ message: "Email is already registered." });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    await User.create({
      phone_number,
      password: hashedPassword,
      email: email.toLowerCase(),
      fullname: email.toLowerCase(),
      username,
      role: "customer",
      outlet: "N/A",
      isApproved: 1,
      status: "approved",
    });

    return res.json({ message: "Customer registered successfully" });
  } catch (err) {
    console.error("Customer signup error:", err.message);
    return res.status(500).json({ message: "Server error during signup", error: err.message });
  }
});

// Validate token endpoint
router.get("/validate", async (req, res) => {
  const authHeader = req.headers.authorization;
  console.log("[VALIDATE] Authorization header:", authHeader);

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    console.log("[VALIDATE] No token provided or invalid format");
    return res.status(401).json({ message: "No token provided" });
  }

  const token = authHeader.split(" ")[1];
  console.log("[VALIDATE] Token extracted:", token?.substring(0, 20) + "...");

  if (!token) {
    console.log("[VALIDATE] No token found after split");
    return res.status(401).json({ message: "No token provided" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "your_jwt_secret_key");
    console.log("[VALIDATE] Token validated successfully:", {
      userId: decoded.userId,
      role: decoded.role,
      email: decoded.email,
    });

    try {
      const user = await User.findById(decoded.userId).lean();

      if (!user) {
        console.log("[VALIDATE] User not found in database:", decoded.userId);
        return res.status(401).json({ message: "User not found" });
      }

      if (user.isApproved === 0) {
        console.log("[VALIDATE] User not approved:", decoded.userId);
        return res.status(403).json({ message: "Account not approved" });
      }

      console.log("[VALIDATE] Validation successful for user:", user._id);
      res.json({
        success: true,
        userId: user._id.toString(),
        user: {
          id: user._id.toString(),
          email: user.email,
          role: user.role,
          fullname: user.fullname,
          username: user.username,
          phone_number: user.phone_number,
        },
      });
    } catch (dbError) {
      console.error("[VALIDATE] Database error:", dbError);
      return res.status(500).json({ message: "Server error" });
    }
  } catch (err) {
    console.error("[VALIDATE] Token verification error:", err.message);
    res.status(401).json({ message: "Invalid or expired token" });
  }
});

// Token validation endpoint
router.get("/validate-token", async (req, res) => {
  const authHeader = req.headers.authorization;
  console.log("[VALIDATE-TOKEN] Authorization header:", authHeader);

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    console.log("[VALIDATE-TOKEN] No token provided or invalid format");
    return res.status(401).json({ message: "No token provided" });
  }

  const token = authHeader.split(" ")[1];
  console.log("[VALIDATE-TOKEN] Token extracted:", token?.substring(0, 20) + "...");

  if (!token) {
    console.log("[VALIDATE-TOKEN] No token found after split");
    return res.status(401).json({ message: "No token provided" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "your_jwt_secret_key");
    console.log("[VALIDATE-TOKEN] Token validated successfully:", {
      userId: decoded.userId,
      role: decoded.role,
      email: decoded.email,
    });

    try {
      const user = await User.findById(decoded.userId).lean();

      if (!user) {
        console.log("[VALIDATE-TOKEN] User not found in database:", decoded.userId);
        return res.status(401).json({ message: "User not found" });
      }

      if (user.isApproved === 0) {
        console.log("[VALIDATE-TOKEN] User not approved:", decoded.userId);
        return res.status(403).json({ message: "Account not approved" });
      }

      console.log("[VALIDATE-TOKEN] Validation successful for user:", user._id);
      res.json({
        valid: true,
        userId: user._id.toString(),
        role: user.role,
        email: user.email,
      });
    } catch (dbError) {
      console.error("[VALIDATE-TOKEN] Database error:", dbError);
      return res.status(500).json({ message: "Server error" });
    }
  } catch (err) {
    console.error("[VALIDATE-TOKEN] Token verification error:", err.message);
    res.status(401).json({ message: "Invalid or expired token" });
  }
});

// Token refresh endpoint
router.post("/refresh", async (req, res) => {
  const token = req.headers.authorization?.split(" ")[1];

  if (!token) {
    return res.status(401).json({ message: "No token provided" });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET, { ignoreExpiration: true });

    const tokenAge = Date.now() / 1000 - decoded.iat;
    if (tokenAge > 7 * 24 * 60 * 60) {
      return res.status(401).json({ message: "Token too old, please login again" });
    }

    try {
      const user = await User.findById(decoded.userId).lean();

      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

      if (user.isApproved === 0) {
        return res.status(403).json({ message: "Account not approved" });
      }

      const newPayload = {
        userId: user._id.toString(),
        role: user.role,
        email: user.email || undefined,
        phone_number: user.phone_number || undefined,
      };

      const newToken = jwt.sign(newPayload, JWT_SECRET, { expiresIn: "1h" });

      console.log(`Token refreshed for user: ${user._id} (${user.email || user.phone_number})`);

      res.json({
        success: true,
        token: newToken,
        user: {
          id: user._id.toString(),
          role: user.role,
          email: user.email,
          phone_number: user.phone_number,
        },
      });
    } catch (dbError) {
      console.error("Database error during token refresh:", dbError);
      return res.status(500).json({ message: "Server error" });
    }
  } catch (error) {
    console.error("Token refresh error:", error.message);
    return res.status(401).json({ message: "Invalid token" });
  }
});

module.exports = router;
