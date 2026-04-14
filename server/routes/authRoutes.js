const express = require("express");
const router = express.Router();
const rateLimit = require("express-rate-limit");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const {
  PASSWORD_POLICY_MESSAGE,
  isPasswordValid,
} = require("../utils/passwordPolicy");
const { sendPasswordResetEmail } = require("../utils/email");
const {
  setCustomerAuthCookie,
  setStaffAuthCookie,
  clearAllAuthCookies,
  getRawAccessTokenFromRequest,
  refreshAuthCookieForRole,
} = require("../utils/authCookies");

const JWT_SECRET = process.env.JWT_SECRET;
const FRONTEND_URL =
  process.env.FRONTEND_URL ||
  process.env.APP_URL ||
  process.env.CLIENT_URL ||
  "http://localhost:3000";
const PASSWORD_RESET_TOKEN_PURPOSE = "password-reset";
const PASSWORD_RESET_TOKEN_EXPIRY = "30m";
const PASSWORD_RESET_ELIGIBLE_ROLES = ["staff", "manager", "customer"];
if (!JWT_SECRET) {
  console.error("JWT_SECRET is not set in environment variables");
  process.exit(1);
}

const authWriteLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many requests. Please try again later." },
});

const authResetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many requests. Please try again later." },
});

const authReadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many requests. Please try again later." },
});

const normalizeEmail = (email) =>
  typeof email === "string" ? email.trim().toLowerCase() : "";

const buildPasswordResetSecret = (passwordHash) =>
  `${JWT_SECRET}:${passwordHash || "no-password"}`;

const buildPasswordResetUrl = (token) => {
  const normalizedBaseUrl = FRONTEND_URL.replace(/\/+$/, "");
  return `${normalizedBaseUrl}/reset-password?token=${encodeURIComponent(token)}`;
};

const createPasswordResetToken = (user) =>
  jwt.sign(
    {
      userId: user._id.toString(),
      role: user.role,
      purpose: PASSWORD_RESET_TOKEN_PURPOSE,
    },
    buildPasswordResetSecret(user.password),
    { expiresIn: PASSWORD_RESET_TOKEN_EXPIRY },
  );

const resolveResetUserFromToken = async (token) => {
  const decoded = jwt.decode(token);

  if (
    !decoded ||
    typeof decoded !== "object" ||
    !decoded.userId ||
    decoded.purpose !== PASSWORD_RESET_TOKEN_PURPOSE
  ) {
    return { user: null, error: "Invalid or expired reset link" };
  }

  const user = await User.findById(decoded.userId).select(
    "password role email fullname",
  );

  if (
    !user ||
    !PASSWORD_RESET_ELIGIBLE_ROLES.includes(user.role) ||
    !user.password
  ) {
    return { user: null, error: "Invalid or expired reset link" };
  }

  try {
    jwt.verify(token, buildPasswordResetSecret(user.password));
    return { user, error: null };
  } catch (error) {
    return { user: null, error: "Invalid or expired reset link" };
  }
};

const requestPasswordReset = async (req, res, allowedRoles) => {
  const normalizedEmail = normalizeEmail(req.body?.email);

  if (!normalizedEmail) {
    return res.status(400).json({ message: "Email is required" });
  }

  try {
    const user = await User.findOne({
      email: normalizedEmail,
      role: { $in: allowedRoles },
    }).select("email fullname role password");

    if (user?.password) {
      try {
        const resetToken = createPasswordResetToken(user);
        const resetUrl = buildPasswordResetUrl(resetToken);

        await sendPasswordResetEmail({
          email: user.email,
          fullname: user.fullname,
          resetUrl,
        });
      } catch (emailError) {
        console.error("Failed to send password reset email:", {
          email: normalizedEmail,
          message: emailError.message,
        });
      }
    }

    return res.status(200).json({
      success: true,
      message:
        "If an account exists for that email, password reset instructions have been sent.",
    });
  } catch (error) {
    console.error("Forgot password error:", error.message);
    return res.status(500).json({ message: "Server error" });
  }
};

const validatePasswordResetToken = async (req, res) => {
  const token =
    typeof req.query?.token === "string" ? req.query.token.trim() : "";

  if (!token) {
    return res.status(400).json({ message: "Reset token is required" });
  }

  try {
    const { user, error } = await resolveResetUserFromToken(token);

    if (!user) {
      return res.status(401).json({ message: error });
    }

    return res.status(200).json({
      valid: true,
      email: user.email,
      role: user.role,
    });
  } catch (routeError) {
    console.error("Reset token validation error:", routeError.message);
    return res.status(500).json({ message: "Server error" });
  }
};

const resetPasswordWithToken = async (req, res) => {
  const token =
    typeof req.body?.token === "string" ? req.body.token.trim() : "";
  const newPassword = req.body?.password;

  if (!token || !newPassword) {
    return res
      .status(400)
      .json({ message: "Reset token and new password are required" });
  }

  if (!isPasswordValid(newPassword)) {
    return res.status(400).json({ message: PASSWORD_POLICY_MESSAGE });
  }

  try {
    const { user, error } = await resolveResetUserFromToken(token);

    if (!user) {
      return res.status(401).json({ message: error });
    }

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();

    return res.status(200).json({
      success: true,
      message: "Password reset successful",
    });
  } catch (routeError) {
    console.error("Reset password error:", routeError.message);
    return res.status(500).json({ message: "Server error" });
  }
};

// Helper function to handle sign-in logic
const handleSignIn = async (req, res, allowedRoles) => {
  if (!req.body) {
    return res.status(400).json({ message: "Request body is missing" });
  }

  const { email, password } = req.body;
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail || !password) {
    return res.status(400).json({ message: "Email and password required" });
  }

  try {
    const user = await User.findOne({ email: normalizedEmail }).lean();

    if (!user) {
      console.log(
        `[Auth Failure] Reason: User not found for email: ${normalizedEmail}`,
      );
      return res.status(401).json({ message: "Invalid email or password" });
    }

    if (!allowedRoles.includes(user.role)) {
      console.log(
        `[Auth Failure] Reason: Role not allowed. User role: '${user.role}', Allowed roles: '${allowedRoles.join(", ")}'`,
      );
      return res.status(403).json({
        message: `Access restricted to ${allowedRoles.join(" or ")} only`,
      });
    }

    if (user.isApproved === 0) {
      console.log(
        `[Auth Failure] Reason: User account not approved for email: ${normalizedEmail}`,
      );
      return res
        .status(403)
        .json({ message: "Account pending approval by manager" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      console.log(
        `[Auth Failure] Reason: Incorrect password for email: ${normalizedEmail}`,
      );
      return res.status(401).json({ message: "Invalid email or password" });
    }

    console.log(
      `Sign-in successful for user: ${user._id} (${user.email}) with role: ${user.role}`,
    );

    const payload = {
      userId: user._id.toString(),
      role: user.role,
      email: user.email,
    };

    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: "1h" });

    setStaffAuthCookie(res, token);

    res.status(200).json({
      success: true,
      user: {
        id: user._id.toString(),
        fullname: user.fullname,
        username: user.username,
        email: user.email,
        role: user.role,
        outlet: user.outlet,
        profile_picture:
          user.profile_picture || "/Uploads/profile_pictures/default.jpg",
      },
    });
  } catch (err) {
    console.error("Database error:", err.message);
    return res.status(500).json({ message: "Server error" });
  }
};

// Customer Sign-In route (phone-based)
router.post("/customer/signin", authWriteLimiter, async (req, res) => {
  if (!req.body) {
    return res.status(400).json({ message: "Request body is missing" });
  }

  const { phone_number, email, password } = req.body;
  const rawIdentifier =
    typeof phone_number === "string" ? phone_number.trim() : "";
  const normalizedEmail = normalizeEmail(email || rawIdentifier);
  const normalizedPhone = rawIdentifier.includes("@") ? "" : rawIdentifier;

  if ((!normalizedPhone && !normalizedEmail) || !password) {
    return res
      .status(400)
      .json({ message: "Email/phone and password required" });
  }

  try {
    const customerQuery = {
      role: "customer",
      ...(normalizedEmail
        ? { email: normalizedEmail }
        : { phone_number: normalizedPhone }),
    };

    const user = await User.findOne(customerQuery).lean();

    if (!user) {
      const attemptedIdentifier = normalizedEmail || normalizedPhone;
      console.log(
        `Sign-in failed: No customer found with identifier: ${attemptedIdentifier}`,
      );
      return res.status(401).json({ message: "Invalid credentials" });
    }

    if (user.isApproved === 0) {
      return res
        .status(403)
        .json({ message: "Account pending approval by manager" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      const attemptedIdentifier = normalizedEmail || normalizedPhone;
      console.log(
        `Sign-in failed: Wrong password for identifier: ${attemptedIdentifier}`,
      );
      return res.status(401).json({ message: "Invalid credentials" });
    }

    console.log(
      `Sign-in successful for user: ${user._id} (${user.phone_number}) with role: ${user.role}`,
    );

    const payload = {
      userId: user._id.toString(),
      role: user.role,
      phone_number: user.phone_number,
    };

    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: "1h" });

    setCustomerAuthCookie(res, token);

    res.status(200).json({
      success: true,
      user: {
        id: user._id.toString(),
        fullname: user.fullname,
        username: user.username,
        phone_number: user.phone_number,
        role: user.role,
        outlet: user.outlet,
        profile_picture:
          user.profile_picture || "/Uploads/profile_pictures/default.jpg",
      },
    });
  } catch (err) {
    console.error("Database error:", err.message);
    return res.status(500).json({ message: "Server error" });
  }
});

// Staff/Manager Sign-In route
router.post("/staff/signin", authWriteLimiter, (req, res) => {
  handleSignIn(req, res, ["staff", "manager"]);
});

// Generic forgot/reset endpoints for all account types with email/password.
router.post("/forgot-password", authResetLimiter, (req, res) =>
  requestPasswordReset(req, res, PASSWORD_RESET_ELIGIBLE_ROLES),
);
router.get("/reset-password/validate", validatePasswordResetToken);
router.post("/reset-password", authResetLimiter, resetPasswordWithToken);

router.post("/logout", authWriteLimiter, (req, res) => {
  clearAllAuthCookies(res);
  res.json({ success: true, message: "Logged out" });
});

// Staff/Manager Signup route
router.post("/signup", authWriteLimiter, async (req, res) => {
  if (!req.body) {
    return res.status(400).json({ message: "Request body is missing" });
  }

  const { email, password, fullname, username, userType, outlet } = req.body;

  if (!email || !password || !fullname || !username || !userType) {
    return res
      .status(400)
      .json({ message: "Please fill all required fields." });
  }

  if (!isPasswordValid(password)) {
    return res.status(400).json({ message: PASSWORD_POLICY_MESSAGE });
  }

  const allowedRoles = ["staff", "manager"];
  if (!allowedRoles.includes(userType)) {
    return res
      .status(400)
      .json({ message: "Invalid user type. Must be 'staff' or 'manager'." });
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
    return res.status(500).json({ message: "Server error during signup" });
  }
});

// Customer Signup route
router.post("/customer/signup", authWriteLimiter, async (req, res) => {
  if (!req.body) {
    return res.status(400).json({ message: "Request body is missing" });
  }

  const { phone_number, password, email, username, fullname } = req.body;

  if (!password || !email || !username) {
    return res
      .status(400)
      .json({ message: "Please fill all required fields." });
  }

  if (!isPasswordValid(password)) {
    return res.status(400).json({ message: PASSWORD_POLICY_MESSAGE });
  }

  try {
    if (phone_number) {
      const phoneCount = await User.countDocuments({ phone_number });
      if (phoneCount > 0) {
        return res
          .status(400)
          .json({ message: "Phone number is already registered." });
      }
    }

    const emailCount = await User.countDocuments({
      email: email.toLowerCase(),
    });
    if (emailCount > 0) {
      return res.status(400).json({ message: "Email is already registered." });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    await User.create({
      phone_number: phone_number || null,
      password: hashedPassword,
      email: email.toLowerCase(),
      fullname: (fullname && String(fullname).trim()) || email.toLowerCase(),
      username,
      role: "customer",
      outlet: "N/A",
      isApproved: 1,
      status: "approved",
    });

    return res.json({ message: "Customer registered successfully" });
  } catch (err) {
    console.error("Customer signup error:", err.message);
    return res.status(500).json({ message: "Server error during signup" });
  }
});

// Validate token endpoint
router.get("/validate", authReadLimiter, async (req, res) => {
  const token = getRawAccessTokenFromRequest(req);

  if (!token) {
    return res.status(401).json({ message: "No token provided" });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);

    try {
      const user = await User.findById(decoded.userId).lean();

      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

      if (user.isApproved === 0) {
        return res.status(403).json({ message: "Account not approved" });
      }

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
router.get("/validate-token", authReadLimiter, async (req, res) => {
  const token = getRawAccessTokenFromRequest(req);

  if (!token) {
    return res.status(401).json({ message: "No token provided" });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);

    try {
      const user = await User.findById(decoded.userId).lean();

      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

      if (user.isApproved === 0) {
        return res.status(403).json({ message: "Account not approved" });
      }

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
router.post("/refresh", authWriteLimiter, async (req, res) => {
  const token = getRawAccessTokenFromRequest(req);

  if (!token) {
    return res.status(401).json({ message: "No token provided" });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET, { ignoreExpiration: true });

    const tokenAge = Date.now() / 1000 - decoded.iat;
    if (tokenAge > 7 * 24 * 60 * 60) {
      return res
        .status(401)
        .json({ message: "Token too old, please login again" });
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

      refreshAuthCookieForRole(res, user.role, newToken);

      console.log(
        `Token refreshed for user: ${user._id} (${user.email || user.phone_number})`,
      );

      res.json({
        success: true,
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
