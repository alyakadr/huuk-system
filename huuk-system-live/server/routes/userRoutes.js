const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const pool = require("../config/db");
const { createUser, checkUsernameExists } = require("../models/userModel");
const { profilePictureUpload } = require("../middlewares/uploadMiddleware");

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error("JWT_SECRET not set");
  process.exit(1);
}

const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) {
    console.error("No token provided");
    return res.status(401).json({ message: "No token provided" });
  }
  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      console.error("Token verification error:", err.message);
      return res.status(401).json({ message: "Invalid or expired token" });
    }
    req.userId = String(decoded.userId);
    req.role = decoded.role;
    console.log("Decoded token:", { userId: req.userId, role: decoded.role });
    next();
  });
};

router.post("/auth/signup", async (req, res) => {
  const { email, password, userType, fullname, outlet, username } = req.body;
  if (!email || !password || !userType || !fullname || !username) {
    return res.status(400).json({ message: "All fields are required" });
  }
  let connection;
  try {
    connection = await pool.getConnection();
    const [results] = await connection.query(
      "SELECT COUNT(*) AS count FROM users WHERE email = ?",
      [email]
    );
    if (results[0].count > 0) {
      return res.status(400).json({ message: "Email already registered" });
    }

    checkUsernameExists(username, (err, exists) => {
      if (err) {
        console.error("Error checking username:", err.message);
        return res
          .status(500)
          .json({ message: "Server error", detail: err.message });
      }
      if (exists && (userType === "staff" || userType === "manager")) {
        return res
          .status(400)
          .json({ message: "Username already taken by staff or manager" });
      }

      createUser(
        email,
        password,
        userType,
        fullname,
        outlet,
        username,
        (err, result) => {
          if (err) {
            console.error("Error creating user:", err.message);
            return res
              .status(500)
              .json({ message: "Server error", detail: err.message });
          }
          res.json({ message: "User registered successfully" });
        }
      );
    });
  } catch (error) {
    console.error("Sign-up error:", error.message);
    res.status(500).json({ message: "Server error", detail: error.message });
  } finally {
    if (connection) connection.release();
  }
});

router.post("/auth/signin", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ message: "Email and password required" });
  }
  let connection;
  try {
    connection = await pool.getConnection();
    const [results] = await connection.query(
      "SELECT * FROM users WHERE email = ?",
      [email]
    );
    if (results.length === 0) {
      return res.status(401).json({ message: "Invalid credentials" });
    }
    const user = results[0];
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid credentials" });
    }
    const token = jwt.sign(
      { userId: String(user.id), role: user.role, fullname: user.fullname },
      JWT_SECRET,
      { expiresIn: "1h" }
    );
    console.log("Generated token with userId:", user.id);
    res.json({
      success: true,
      token,
      user: {
        id: String(user.id),
        email: user.email,
        role: user.role,
        outlet: user.outlet,
        fullname: user.fullname,
        username: user.username,
      },
    });
  } catch (error) {
    console.error("Signin error:", error.message);
    res.status(500).json({ message: "Server error", detail: error.message });
  } finally {
    if (connection) connection.release();
  }
});

router.get("/all-approvals", verifyToken, async (req, res) => {
  if (req.role !== "manager") {
    return res.status(403).json({ message: "Manager role required" });
  }
  let connection;
  try {
    connection = await pool.getConnection();
    const [results] = await connection.query(`
      SELECT id, fullname, username, email, outlet, created_at AS createdAt, 
        CASE WHEN isApproved = 1 THEN 'approved' WHEN isApproved = 0 THEN 'pending' ELSE 'rejected' END AS status
      FROM users
      WHERE role IN ('staff', 'manager')
      ORDER BY isApproved, created_at DESC
    `);
    res.json(results);
  } catch (err) {
    console.error("Error fetching approvals:", err.message);
    return res
      .status(500)
      .json({ message: "Server error", detail: err.message });
  } finally {
    if (connection) connection.release();
  }
});

router.post("/update-status/:id", verifyToken, async (req, res) => {
  if (req.role !== "manager") {
    return res.status(403).json({ message: "Manager role required" });
  }
  const userId = req.params.id;
  const { status } = req.body;
  if (!["approved", "rejected"].includes(status)) {
    return res.status(400).json({ message: "Invalid status" });
  }
  let connection;
  try {
    connection = await pool.getConnection();
    const isApproved = status === "approved" ? 1 : 0;
    const [result] = await connection.query(
      "UPDATE users SET status = ?, isApproved = ? WHERE id = ?",
      [status, isApproved, userId]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "User not found" });
    }
    // Emit WebSocket event with timing log
    const io = req.app.get("socketio");
    if (io) {
      console.log("Emitting pendingStaffUpdate at:", new Date().toISOString(), {
        action: status === "approved" ? "remove" : "update",
        userId: Number(userId),
        status,
      });
      io.emit("pendingStaffUpdate", {
        action: status === "approved" ? "remove" : "update",
        userId: Number(userId),
        status,
      });
    }
    res.json({ message: `User ${status} successfully` });
  } catch (err) {
    console.error("Error updating status:", err.message);
    return res
      .status(500)
      .json({ message: "Server error", detail: err.message });
  } finally {
    if (connection) connection.release();
  }
});

router.get("/pending-approval", verifyToken, async (req, res) => {
  if (req.role !== "manager") {
    return res.status(403).json({ message: "Manager role required" });
  }
  let connection;
  try {
    connection = await pool.getConnection();
    const [results] = await connection.query(`
      SELECT id, fullname, username, email, outlet, created_at AS createdAt, 'pending' AS status
      FROM users
      WHERE isApproved = 0 AND role IN ('staff', 'manager')
    `);
    res.json(results);
  } catch (err) {
    console.error("Error fetching pending approvals:", err.message);
    return res
      .status(500)
      .json({ message: "Server error", detail: err.message });
  } finally {
    if (connection) connection.release();
  }
});

router.post("/approve/:id", verifyToken, async (req, res) => {
  if (req.role !== "manager") {
    return res.status(403).json({ message: "Manager role required" });
  }
  const userId = req.params.id;
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();
    const [result] = await connection.query(
      "UPDATE users SET isApproved = 1 WHERE id = ?",
      [userId]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    const [updatedUser] = await connection.query(
      "SELECT id, fullname, username, email, outlet, created_at AS createdAt, 'approved' AS status FROM users WHERE id = ?",
      [userId]
    );

    await connection.commit();

    // Emit WebSocket event with timing log
    const io = req.app.get("socketio");
    if (io) {
      console.log("Emitting pendingStaffUpdate at:", new Date().toISOString(), {
        action: "remove",
        userId: Number(userId),
      });
      io.emit("pendingStaffUpdate", {
        action: "remove",
        userId: Number(userId),
      });
    }

    res.json({ message: "User approved" });
  } catch (err) {
    if (connection) await connection.rollback();
    console.error("Error approving user:", err.message);
    return res
      .status(500)
      .json({ message: "Server error", detail: err.message });
  } finally {
    if (connection) connection.release();
  }
});

router.get("/list", verifyToken, async (req, res) => {
  if (req.role !== "manager") {
    return res.status(403).json({ message: "Manager role required" });
  }
  let connection;
  try {
    connection = await pool.getConnection();
    const [results] = await connection.query(`
      SELECT id, fullname, username, email, role, outlet, created_at AS createdAt, 'approved' AS status
      FROM users 
      WHERE isApproved = 1 AND role IN ('staff', 'manager')
    `);
    res.json(results);
  } catch (err) {
    console.error("Error fetching user list:", err.message);
    return res
      .status(500)
      .json({ message: "Server error", detail: err.message });
  } finally {
    if (connection) connection.release();
  }
});

router.post("/checkUsername", async (req, res) => {
  const { username, userType } = req.body;
  if (!username) {
    return res.status(400).json({ message: "Username required" });
  }
  let connection;
  try {
    connection = await pool.getConnection();
    const [results] = await connection.query(
      "SELECT COUNT(*) AS count FROM users WHERE username = ? AND role IN ('staff', 'manager')",
      [username]
    );
    if (
      results[0].count > 0 &&
      (userType === "staff" || userType === "manager")
    ) {
      return res.json({ exists: true });
    }
    res.json({ exists: false });
  } catch (err) {
    console.error("Error checking username:", err.message);
    return res
      .status(500)
      .json({ message: "Server error", detail: err.message });
  } finally {
    if (connection) connection.release();
  }
});

router.get("/check-username/:username", async (req, res) => {
  const username = req.params.username;
  let connection;
  try {
    connection = await pool.getConnection();
    const [results] = await connection.query(
      "SELECT COUNT(*) AS count FROM users WHERE username = ?",
      [username]
    );
    res.json({ exists: results[0].count > 0 });
  } catch (err) {
    console.error("Error checking username:", err.message);
    return res
      .status(500)
      .json({ message: "Server error", detail: err.message });
  } finally {
    if (connection) connection.release();
  }
});

router.post("/checkEmail", async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ message: "Email required" });
  }
  let connection;
  try {
    connection = await pool.getConnection();
    const [results] = await connection.query(
      "SELECT COUNT(*) AS count FROM users WHERE email = ?",
      [email]
    );
    res.json({ exists: results[0].count > 0 });
  } catch (err) {
    console.error("Error checking email:", err.message);
    return res
      .status(500)
      .json({ message: "Server error", detail: err.message });
  } finally {
    if (connection) connection.release();
  }
});

router.post("/change-password/:id", verifyToken, async (req, res) => {
  const userIdParam = req.params.id;
  const userIdFromToken = req.userId;
  if (userIdParam !== userIdFromToken) {
    return res
      .status(403)
      .json({ message: "Cannot change another user's password" });
  }
  const { oldPassword, newPassword } = req.body;
  if (!oldPassword || !newPassword) {
    return res.status(400).json({ message: "Both passwords required" });
  }
  let connection;
  try {
    connection = await pool.getConnection();
    const [results] = await connection.query(
      "SELECT password FROM users WHERE id = ?",
      [userIdParam]
    );
    if (results.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }
    const hashedPassword = results[0].password;
    const isMatch = await bcrypt.compare(oldPassword, hashedPassword);
    if (!isMatch) {
      return res.status(401).json({ message: "Old password incorrect" });
    }
    const hashedNewPassword = await bcrypt.hash(newPassword, 10);
    await connection.query("UPDATE users SET password = ? WHERE id = ?", [
      hashedNewPassword,
      userIdParam,
    ]);
    res.json({ message: "Password updated successfully" });
  } catch (err) {
    console.error("Error updating password:", err.message);
    return res
      .status(500)
      .json({ message: "Server error", detail: err.message });
  } finally {
    if (connection) connection.release();
  }
});

router.get("/profile", verifyToken, async (req, res) => {
  const userId = req.userId;
  let connection;
  try {
    connection = await pool.getConnection();
    const [results] = await connection.query(
      `
      SELECT id, fullname, username, email, address, phone_number, profile_picture, role, outlet,
        CASE WHEN isApproved = 1 THEN 'approved' ELSE 'pending' END AS status
      FROM users 
      WHERE id = ?
    `,
      [userId]
    );
    if (results.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }
    const user = results[0];
    if (
      user.profile_picture &&
      user.profile_picture !== "/Uploads/profile_pictures/null"
    ) {
      const filePath = path.join(__dirname, "..", user.profile_picture);
      if (!fs.existsSync(filePath)) {
        user.profile_picture = "/Uploads/profile_pictures/default.jpg";
      }
    }
    res.json(user);
  } catch (err) {
    console.error("Error fetching profile:", err.message);
    return res
      .status(500)
      .json({ message: "Server error", detail: err.message });
  } finally {
    if (connection) connection.release();
  }
});

router.patch(
  "/update-profile/:id",
  verifyToken,
  (req, res, next) => {
    // Custom multer handler with better error handling
    profilePictureUpload.single("profile_picture")(req, res, (err) => {
      if (err) {
        console.error("Multer error:", err.message);
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ message: "File too large. Maximum size is 5MB." });
        }
        return res.status(400).json({ message: "File upload error: " + err.message });
      }
      next();
    });
  },
  async (req, res) => {
    console.log('Update profile request received:', {
      userId: req.userId,
      params: req.params,
      body: req.body,
      file: req.file ? { filename: req.file.filename, size: req.file.size } : 'No file'
    });

    const { address, phone_number } = req.body;
    const profile_picture = req.file
      ? `/Uploads/profile_pictures/${req.file.filename}`
      : null;
    const userIdFromToken = req.userId;
    const profileIdFromParams = req.params.id;

    if (Number(profileIdFromParams) !== Number(userIdFromToken)) {
      console.error('User ID mismatch:', { tokenId: userIdFromToken, paramId: profileIdFromParams });
      return res.status(403).json({ message: "User ID mismatch" });
    }

    let connection;
    try {
      connection = await pool.getConnection();
      
      console.log('Updating user with:', {
        address: address || null,
        phone_number: phone_number || null,
        profile_picture,
        id: profileIdFromParams
      });
      
      await connection.query(
        `
        UPDATE users 
        SET address = ?, phone_number = ?, profile_picture = COALESCE(?, profile_picture)
        WHERE id = ?
      `,
        [
          address || null,
          phone_number || null,
          profile_picture,
          profileIdFromParams,
        ]
      );
      
      const [results] = await connection.query(
        `
          SELECT id, fullname, username, email, address, phone_number, profile_picture, role, outlet,
            CASE WHEN isApproved = 1 THEN 'approved' ELSE 'pending' END AS status
          FROM users 
          WHERE id = ?
        `,
        [profileIdFromParams]
      );
      
      console.log('Profile update successful:', results[0]);
      res.json(results[0]);
    } catch (err) {
      console.error("Error updating profile:", {
        message: err.message,
        stack: err.stack,
        code: err.code
      });
      return res
        .status(500)
        .json({ message: "Server error", detail: err.message });
    } finally {
      if (connection) connection.release();
    }
  }
);

router.get("/staffs", verifyToken, async (req, res) => {
  if (req.role !== "manager") {
    return res.status(403).json({ message: "Manager role required" });
  }
  let connection;
  try {
    connection = await pool.getConnection();
    const [results] = await connection.query(
      `
      SELECT id, fullname, username, email, phone_number, profile_picture, outlet, 'approved' AS status
      FROM users 
      WHERE role = 'staff' AND isApproved = 1
    `
    );
    const updatedResults = results.map((user) => {
      if (
        user.profile_picture &&
        user.profile_picture !== "/Uploads/profile_pictures/null"
      ) {
        const filePath = path.join(__dirname, "..", user.profile_picture);
        if (!fs.existsSync(filePath)) {
          user.profile_picture = "/Uploads/profile_pictures/default.jpg";
        }
      }
      return user;
    });
    res.json(updatedResults);
  } catch (err) {
    console.error("Error fetching staff list:", err.message);
    return res
      .status(500)
      .json({ message: "Server error", detail: err.message });
  } finally {
    if (connection) connection.release();
  }
});

router.get("/outlets", verifyToken, async (req, res) => {
  if (req.role !== "manager") {
    return res.status(403).json({ message: "Manager role required" });
  }
  let connection;
  try {
    connection = await pool.getConnection();
    const [results] = await connection.query(
      `
      SELECT DISTINCT outlet
      FROM users
      WHERE outlet IS NOT NULL AND outlet != ''
      ORDER BY outlet
    `
    );
    const outlets = results.map((row) => row.outlet);
    console.log("Fetched outlets:", outlets);
    res.json({ outlets });
  } catch (err) {
    console.error("Error fetching outlets:", err.message);
    return res
      .status(500)
      .json({ message: "Server error", detail: err.message });
  } finally {
    if (connection) connection.release();
  }
});

router.get("/test-search", async (req, res) => {
  const query = req.query.q ? req.query.q.toLowerCase() : "";
  if (!query) {
    return res.status(400).json({ message: "Search query required" });
  }

  console.log("Test search endpoint reached with query:", query);

  try {
    console.log("Returning test response");
    res.json({
      message: "Test search endpoint working",
      query: query,
      clients: [],
      appointments: [],
      services: []
    });
  } catch (err) {
    console.error("Error in test search endpoint:", err.message);
    return res.status(500).json({ message: "Server error", detail: err.message });
  }
});

router.get("/search", verifyToken, async (req, res) => {
  const query = req.query.q ? req.query.q.toLowerCase() : "";
  if (!query) {
    return res.status(400).json({ message: "Search query required" });
  }

  console.log("Search endpoint reached with query:", query);

  // Start with a simple test response
  try {
    console.log("Returning simple test response");
    res.json({
      message: "Search endpoint working",
      query: query,
      clients: [],
      appointments: [],
      services: []
    });
  } catch (err) {
    console.error("Error in search endpoint:", err.message);
    console.error("Full error:", err);
    return res.status(500).json({ message: "Server error", detail: err.message });
  }
});

// Services endpoint with duration filtering only
router.get("/services", verifyToken, async (req, res) => {
  console.log('[SERVICES] Endpoint called - Request parameters:', req.query);
  console.log('[SERVICES] User from token:', { userId: req.userId, role: req.role });
  
  let connection;
  try {
    console.log('[SERVICES] Attempting to get database connection...');
    connection = await pool.getConnection();
    console.log('[SERVICES] Database connection acquired successfully');
    
    // Get query parameters for filtering
    const { maxDuration } = req.query;
    console.log('[SERVICES] Max duration filter:', maxDuration);
    
    // Fetch services from database
    console.log('[SERVICES] Executing SQL query: SELECT id, name, duration, price FROM services ORDER BY name');
    const [results] = await connection.query(
      "SELECT id, name, duration, price FROM services ORDER BY name"
    );
    console.log('[SERVICES] SQL query executed successfully, results count:', results.length);
    
    let services = results;
    
    // Filter by maximum duration if specified
    if (maxDuration) {
      const maxDur = parseInt(maxDuration);
      console.log('[SERVICES] Applying max duration filter:', maxDur);
      services = services.filter(service => service.duration <= maxDur);
      console.log(`[SERVICES] Filtered by max duration ${maxDur} minutes: ${services.length} services`);
    }
    
    console.log('[SERVICES] Returning services:', services.length, 'items');
    console.log('[SERVICES] Services data:', services);
    res.json(services);
  } catch (err) {
    console.error("[SERVICES] Error occurred:", {
      message: err.message,
      stack: err.stack,
      code: err.code,
      errno: err.errno,
      sqlState: err.sqlState,
      sqlMessage: err.sqlMessage
    });
    return res
      .status(500)
      .json({ message: "Server error", detail: err.message });
  } finally {
    if (connection) {
      console.log('[SERVICES] Releasing database connection...');
      connection.release();
      console.log('[SERVICES] Database connection released');
    }
  }
});

// Advanced services endpoint with filtering parameters
router.get("/services/available", verifyToken, async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();
    
    const { outlet, date, time, barberId, maxDuration } = req.query;
    
    console.log('[SERVICES API] Available services request:', {
      outlet, date, time, barberId, maxDuration
    });
    
    // Fetch services from database with outlet filtering
    let query = "SELECT s.id, s.name, s.duration, s.price FROM services s";
    let queryParams = [];
    
    // Add outlet filtering if specified
    if (outlet) {
      query += " JOIN service_outlets so ON s.id = so.service_id JOIN outlets o ON so.outlet_id = o.id WHERE UPPER(o.name) = ?";
      queryParams.push(outlet.toUpperCase());
    }
    
    query += " ORDER BY s.name";
    
    const [results] = await connection.query(query, queryParams);
    let services = results;
    
    console.log(`[SERVICES API] Found ${services.length} services from database`);
    
    // If no outlet-specific filtering was done in SQL (because outlet param wasn't provided or no junction table exists),
    // we'll assume all services are available at all outlets for now
    if (!outlet && services.length === 0) {
      // Fallback: get all services if outlet filtering failed
      const [allServices] = await connection.query(
        "SELECT id, name, duration, price FROM services ORDER BY name"
      );
      services = allServices;
      console.log(`[SERVICES API] Fallback: Retrieved all ${services.length} services`);
    }
    
    // Filter by maximum duration
    if (maxDuration) {
      const maxDur = parseInt(maxDuration);
      services = services.filter(service => service.duration <= maxDur);
      console.log(`[SERVICES API] Filtered by max duration ${maxDur}min: ${services.length} services`);
    }
    
    // TODO: Add barber-specific service filtering if needed
    // if (barberId) {
    //   // Filter services based on barber specializations
    // }
    
    // TODO: Add time-specific filtering if needed
    // if (date && time) {
    //   // Filter services based on specific time slot availability
    // }
    
    console.log(`[SERVICES API] Final available services: ${services.length} services`);
    res.json(services);
  } catch (err) {
    console.error("Error fetching available services:", err.message);
    return res
      .status(500)
      .json({ message: "Server error", detail: err.message });
  } finally {
    if (connection) connection.release();
  }
});

// Get user by phone number
router.get("/by-phone/:phoneNumber", verifyToken, async (req, res) => {
  const { phoneNumber } = req.params;
  
  if (!phoneNumber) {
    return res.status(400).json({ message: "Phone number is required" });
  }
  
  console.log(`[USER LOOKUP] Looking up user by phone: ${phoneNumber}`);
  
  let connection;
  try {
    connection = await pool.getConnection();
    
    // Search for user with matching phone number
    const [results] = await connection.query(
      `SELECT id, fullname as name, email, phone_number as phone, role, created_at
       FROM users 
       WHERE phone_number = ? 
       ORDER BY created_at DESC 
       LIMIT 1`,
      [phoneNumber]
    );
    
    if (results.length === 0) {
      console.log(`[USER LOOKUP] No user found for phone: ${phoneNumber}`);
      return res.json({ user: null });
    }
    
    const user = results[0];
    console.log(`[USER LOOKUP] Found user: ${user.name} (ID: ${user.id})`);
    
    res.json({ user });
  } catch (err) {
    console.error("[USER LOOKUP] Error fetching user by phone:", {
      message: err.message,
      stack: err.stack,
      phoneNumber
    });
    res.status(500).json({ message: "Server error", error: err.message });
  } finally {
    if (connection) connection.release();
  }
});

module.exports = router;
