const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const pool = require("../config/db"); // Use pool from db.js

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error("JWT_SECRET is not set in environment variables");
  process.exit(1);
}

// Helper function to handle sign-in logic
const handleSignIn = async (req, res, allowedRoles) => {
  // Check if req.body exists to prevent TypeError
  if (!req.body) {
    return res.status(400).json({ message: "Request body is missing" });
  }

  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: "Email and password required" });
  }

  let connection;
  try {
    connection = await pool.getConnection();
    const [results] = await connection.query(
      "SELECT * FROM users WHERE LOWER(email) = ?",
      [email.toLowerCase()]
    );

    if (results.length === 0) {
      console.log(
        `[Auth Failure] Reason: User not found for email: ${email.toLowerCase()}`
      );
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const user = results[0];

    // Check if user role is allowed
    if (!allowedRoles.includes(user.role)) {
      console.log(
        `[Auth Failure] Reason: Role not allowed. User role: '${
          user.role
        }', Allowed roles: '${allowedRoles.join(", ")}'`
      );
      return res.status(403).json({
        message: `Access restricted to ${allowedRoles.join(" or ")} only`,
      });
    }

    // Check if user is approved
    if (user.isApproved === 0) {
      console.log(
        `[Auth Failure] Reason: User account not approved for email: ${email.toLowerCase()}`
      );
      return res
        .status(403)
        .json({ message: "Account pending approval by manager" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      console.log(
        `[Auth Failure] Reason: Incorrect password for email: ${email.toLowerCase()}`
      );
      return res.status(401).json({ message: "Invalid email or password" });
    }

    console.log(
      `Sign-in successful for user: ${user.id} (${user.email}) with role: ${user.role}`
    );

    const payload = {
      userId: user.id,
      role: user.role,
      email: user.email,
    };

    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: "1h" });

    res.status(200).json({
      success: true,
      user: {
        id: user.id,
        fullname: user.fullname,
        username: user.username,
        email: user.email,
        role: user.role,
        outlet: user.outlet,
        profile_picture:
          user.profile_picture || "/Uploads/profile_pictures/default.jpg",
      },
      token,
    });
  } catch (err) {
    console.error("Database error:", err.message);
    return res.status(500).json({ message: "Server error" });
  } finally {
    if (connection) connection.release();
  }
};

// Customer Sign-In route (phone-based)
router.post("/customer/signin", async (req, res) => {
  // Check if req.body exists to prevent TypeError
  if (!req.body) {
    return res.status(400).json({ message: "Request body is missing" });
  }

  const { phone_number, password } = req.body;

  if (!phone_number || !password) {
    return res
      .status(400)
      .json({ message: "Phone number and password required" });
  }

  let connection;
  try {
    connection = await pool.getConnection();
    const [results] = await connection.query(
      "SELECT * FROM users WHERE phone_number = ? AND role = 'customer'",
      [phone_number]
    );

    if (results.length === 0) {
      console.log(
        `Sign-in failed: No customer found with phone: ${phone_number} (original: ${phone_number})`
      );
      return res
        .status(401)
        .json({ message: "Invalid phone number or password" });
    }

    const user = results[0];

    // Check if user is approved
    if (user.isApproved === 0) {
      return res
        .status(403)
        .json({ message: "Account pending approval by manager" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      console.log(
        `Sign-in failed: Wrong password for phone: ${phone_number} (original: ${phone_number})`
      );
      return res
        .status(401)
        .json({ message: "Invalid phone number or password" });
    }

    console.log(
      `Sign-in successful for user: ${user.id} (${user.phone_number}) with role: ${user.role}`
    );

    const payload = {
      userId: user.id,
      role: user.role,
      phone_number: user.phone_number,
    };

    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: "1h" });

    res.status(200).json({
      success: true,
      user: {
        id: user.id,
        fullname: user.fullname,
        username: user.username,
        phone_number: user.phone_number,
        role: user.role,
        outlet: user.outlet,
        profile_picture:
          user.profile_picture || "/Uploads/profile_pictures/default.jpg",
      },
      token,
    });
  } catch (err) {
    console.error("Database error:", err.message);
    return res.status(500).json({ message: "Server error" });
  } finally {
    if (connection) connection.release();
  }
});

// Staff/Manager Sign-In route
router.post("/staff/signin", (req, res) => {
  handleSignIn(req, res, ["staff", "manager"]);
});

// Staff/Manager Signup route
router.post("/signup", async (req, res) => {
  // Check if req.body exists
  if (!req.body) {
    return res.status(400).json({ message: "Request body is missing" });
  }

  const { email, password, fullname, username, userType, outlet } = req.body;

  if (!email || !password || !fullname || !username || !userType) {
    return res
      .status(400)
      .json({ message: "Please fill all required fields." });
  }

  const allowedRoles = ["staff", "manager"];
  if (!allowedRoles.includes(userType)) {
    return res
      .status(400)
      .json({ message: "Invalid user type. Must be 'staff' or 'manager'." });
  }

  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const emailLower = email.toLowerCase();
    const [emailResult] = await connection.query(
      "SELECT COUNT(*) AS count FROM users WHERE LOWER(email) = ?",
      [emailLower]
    );
    if (emailResult[0].count > 0) {
      return res.status(400).json({ message: "Email is already registered." });
    }

    const [usernameResult] = await connection.query(
      "SELECT COUNT(*) AS count FROM users WHERE username = ?",
      [username]
    );
    if (usernameResult[0].count > 0) {
      return res.status(400).json({ message: "Username is already taken." });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const [result] = await connection.query(
      `
      INSERT INTO users (email, password, fullname, username, role, outlet, isApproved)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
      [
        emailLower,
        hashedPassword,
        fullname,
        username,
        userType,
        outlet || null,
        0,
      ]
    );

    // Fetch the new user for WebSocket emission
    const [newUser] = await connection.query(
      "SELECT id, fullname, username, email, outlet, created_at AS createdAt, 'pending' AS status FROM users WHERE id = ?",
      [result.insertId]
    );

    await connection.commit();

    // Emit WebSocket event
    const io = req.app.get("socketio");
    if (io) {
      io.emit("pendingStaffUpdate", {
        action: "add",
        user: newUser[0],
      });
    }

    return res.json({ message: "User registered successfully" });
  } catch (err) {
    if (connection) await connection.rollback();
    console.error("Signup error:", err.message);
    return res
      .status(500)
      .json({ message: "Server error during signup", error: err.message });
  } finally {
    if (connection) connection.release();
  }
});

// Customer Signup route
router.post("/customer/signup", async (req, res) => {
  console.log("[CUSTOMER SIGNUP] Request received:", {
    body: req.body,
    timestamp: new Date().toISOString()
  });
  
  // Check if req.body exists
  if (!req.body) {
    console.log("[CUSTOMER SIGNUP] Error: Request body is missing");
    return res.status(400).json({ message: "Request body is missing" });
  }

  const { phone_number, password, email, username } = req.body;
  console.log("[CUSTOMER SIGNUP] Extracted fields:", {
    phone_number, 
    password: password ? "[PROVIDED]" : "[MISSING]", 
    email, 
    username
  });

  if (!phone_number || !password || !email || !username) {
    return res
      .status(400)
      .json({ message: "Please fill all required fields." });
  }

  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [phoneResult] = await connection.query(
      "SELECT COUNT(*) AS count FROM users WHERE phone_number = ?",
      [phone_number]
    );
    if (phoneResult[0].count > 0) {
      return res
        .status(400)
        .json({ message: "Phone number is already registered." });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Check if email is already registered
    const [emailResult] = await connection.query(
      "SELECT COUNT(*) AS count FROM users WHERE LOWER(email) = ?",
      [email.toLowerCase()]
    );
    if (emailResult[0].count > 0) {
      return res
        .status(400)
        .json({ message: "Email is already registered." });
    }
    
    await connection.query(
      `
      INSERT INTO users (phone_number, password, email, fullname, username, role, outlet, isApproved)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `,
      [phone_number, hashedPassword, email.toLowerCase(), email.toLowerCase(), username, "customer", "N/A", 1]
    );

    await connection.commit();
    return res.json({ message: "Customer registered successfully" });
  } catch (err) {
    if (connection) await connection.rollback();
    console.error("Customer signup error:", err.message);
    return res
      .status(500)
      .json({ message: "Server error during signup", error: err.message });
  } finally {
    if (connection) connection.release();
  }
});

// Add to existing authRoutes.js
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
      email: decoded.email
    });
    
    // Verify user still exists in database
    let connection;
    try {
      connection = await pool.getConnection();
      const [userResults] = await connection.query(
        "SELECT id, email, role, fullname, username, phone_number, isApproved FROM users WHERE id = ?",
        [decoded.userId]
      );
      
      if (userResults.length === 0) {
        console.log("[VALIDATE] User not found in database:", decoded.userId);
        return res.status(401).json({ message: "User not found" });
      }
      
      const user = userResults[0];
      if (user.isApproved === 0) {
        console.log("[VALIDATE] User not approved:", decoded.userId);
        return res.status(403).json({ message: "Account not approved" });
      }
      
      console.log("[VALIDATE] Validation successful for user:", user.id);
      res.json({ 
        success: true, 
        userId: user.id,
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          fullname: user.fullname,
          username: user.username,
          phone_number: user.phone_number
        }
      });
    } catch (dbError) {
      console.error("[VALIDATE] Database error:", dbError);
      return res.status(500).json({ message: "Server error" });
    } finally {
      if (connection) connection.release();
    }
  } catch (err) {
    console.error("[VALIDATE] Token verification error:", err.message);
    res.status(401).json({ message: "Invalid or expired token" });
  }
});

// Add a token validation endpoint
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
      email: decoded.email
    });
    
    // Verify user still exists in database
    let connection;
    try {
      connection = await pool.getConnection();
      const [userResults] = await connection.query(
        "SELECT id, email, role, fullname, username, phone_number, isApproved FROM users WHERE id = ?",
        [decoded.userId]
      );
      
      if (userResults.length === 0) {
        console.log("[VALIDATE-TOKEN] User not found in database:", decoded.userId);
        return res.status(401).json({ message: "User not found" });
      }
      
      const user = userResults[0];
      if (user.isApproved === 0) {
        console.log("[VALIDATE-TOKEN] User not approved:", decoded.userId);
        return res.status(403).json({ message: "Account not approved" });
      }
      
      console.log("[VALIDATE-TOKEN] Validation successful for user:", user.id);
      res.json({ 
        valid: true, 
        userId: user.id,
        role: user.role,
        email: user.email
      });
    } catch (dbError) {
      console.error("[VALIDATE-TOKEN] Database error:", dbError);
      return res.status(500).json({ message: "Server error" });
    } finally {
      if (connection) connection.release();
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
    // Verify the token (even if expired, we want to check if it's structurally valid)
    const decoded = jwt.verify(token, JWT_SECRET, { ignoreExpiration: true });

    // Check if token is too old (more than 7 days)
    const tokenAge = Date.now() / 1000 - decoded.iat;
    if (tokenAge > 7 * 24 * 60 * 60) {
      return res
        .status(401)
        .json({ message: "Token too old, please login again" });
    }

    let connection;
    try {
      connection = await pool.getConnection();

      // Verify user still exists and is active
      const [userResults] = await connection.query(
        "SELECT id, email, role, isApproved, phone_number FROM users WHERE id = ?",
        [decoded.userId]
      );

      if (userResults.length === 0) {
        return res.status(401).json({ message: "User not found" });
      }

      const user = userResults[0];

      if (user.isApproved === 0) {
        return res.status(403).json({ message: "Account not approved" });
      }

      // Generate new token
      const newPayload = {
        userId: user.id,
        role: user.role,
        email: user.email || undefined,
        phone_number: user.phone_number || undefined,
      };

      const newToken = jwt.sign(newPayload, JWT_SECRET, { expiresIn: "1h" });

      console.log(
        `Token refreshed for user: ${user.id} (${
          user.email || user.phone_number
        })`
      );

      res.json({
        success: true,
        token: newToken,
        user: {
          id: user.id,
          role: user.role,
          email: user.email,
          phone_number: user.phone_number,
        },
      });
    } catch (dbError) {
      console.error("Database error during token refresh:", dbError);
      return res.status(500).json({ message: "Server error" });
    } finally {
      if (connection) connection.release();
    }
  } catch (error) {
    console.error("Token refresh error:", error.message);
    return res.status(401).json({ message: "Invalid token" });
  }
});
module.exports = router;
