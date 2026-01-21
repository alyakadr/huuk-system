const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const moment = require("moment");
const pool = require("../config/db");

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

router.get("/total-all", verifyToken, async (req, res) => {
  if (req.role !== "manager") {
    return res.status(403).json({ message: "Manager role required" });
  }
  let connection;
  try {
    connection = await pool.getConnection();
    const [results] = await connection.query(
      "SELECT COUNT(*) AS count FROM users WHERE role = 'customer'"
    );
    console.log("Fetched total customers:", results[0].count);
    res.json({ count: results[0].count });
  } catch (err) {
    console.error("Error fetching total customers:", err.message);
    res.status(500).json({ message: "Server error", detail: err.message });
  } finally {
    if (connection) connection.release();
  }
});

router.get("/total-up-to-yesterday", verifyToken, async (req, res) => {
  if (req.role !== "manager") {
    return res.status(403).json({ message: "Manager role required" });
  }
  let connection;
  try {
    connection = await pool.getConnection();
    const yesterday = moment().subtract(1, "days").format("YYYY-MM-DD");
    const [results] = await connection.query(
      "SELECT COUNT(*) AS count FROM users WHERE role = 'customer' AND created_at < ?",
      [yesterday]
    );
    console.log("Fetched customers up to yesterday:", results[0].count);
    res.json({ count: results[0].count });
  } catch (err) {
    console.error("Error fetching customers up to yesterday:", err.message);
    res.status(500).json({ message: "Server error", detail: err.message });
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
    const [results] = await connection.query(
      "SELECT id, fullname, username, email, created_at FROM users WHERE role = 'customer'"
    );
    console.log("Fetched customer list:", results.length);
    res.json(results);
  } catch (err) {
    console.error("Error fetching customer list:", err.message);
    res.status(500).json({ message: "Server error", detail: err.message });
  } finally {
    if (connection) connection.release();
  }
});

// Get recent customers (for staff schedule autocomplete)
router.get("/recent", verifyToken, async (req, res) => {
  if (req.role !== "manager" && req.role !== "staff") {
    return res.status(403).json({ message: "Manager or staff role required" });
  }
  let connection;
  try {
    connection = await pool.getConnection();
    const [results] = await connection.query(
      "SELECT id, fullname, username, email, phone_number FROM users WHERE role = 'customer' ORDER BY created_at DESC LIMIT 10"
    );
    console.log("Fetched recent customers:", results.length);
    res.json(results);
  } catch (err) {
    console.error("Error fetching recent customers:", err.message);
    res.status(500).json({ message: "Server error", detail: err.message });
  } finally {
    if (connection) connection.release();
  }
});

// Search customers by name or username (for staff schedule autocomplete)
router.get("/search", verifyToken, async (req, res) => {
  if (req.role !== "manager" && req.role !== "staff") {
    return res.status(403).json({ message: "Manager or staff role required" });
  }
  const { q } = req.query;
  if (!q || q.trim().length < 2) {
    return res.status(400).json({ message: "Search query must be at least 2 characters long" });
  }
  let connection;
  try {
    connection = await pool.getConnection();
    const searchTerm = `%${q.trim()}%`;
    const [results] = await connection.query(
      "SELECT id, fullname, username, email, phone_number FROM users WHERE role = 'customer' AND (fullname LIKE ? OR username LIKE ? OR email LIKE ?) ORDER BY fullname ASC LIMIT 20",
      [searchTerm, searchTerm, searchTerm]
    );
    console.log(`Searched customers with query '${q}':`, results.length);
    res.json(results);
  } catch (err) {
    console.error("Error searching customers:", err.message);
    res.status(500).json({ message: "Server error", detail: err.message });
  } finally {
    if (connection) connection.release();
  }
});

// Get today's customers (for staff schedule autocomplete)
router.get("/today", verifyToken, async (req, res) => {
  if (req.role !== "manager" && req.role !== "staff") {
    return res.status(403).json({ message: "Manager or staff role required" });
  }
  const { date } = req.query;
  if (!date) {
    return res.status(400).json({ message: "Date parameter is required" });
  }
  let connection;
  try {
    connection = await pool.getConnection();
    const [results] = await connection.query(
      `SELECT DISTINCT u.id, u.fullname as name, u.username, u.email, u.phone_number as phone 
       FROM users u 
       JOIN bookings b ON u.id = b.user_id 
       WHERE u.role = 'customer' AND DATE(b.date) = ? 
       ORDER BY u.fullname ASC LIMIT 10`,
      [date]
    );
    console.log(`Fetched today's customers for date '${date}':`, results.length);
    res.json(results);
  } catch (err) {
    console.error("Error fetching today's customers:", err.message);
    res.status(500).json({ message: "Server error", detail: err.message });
  } finally {
    if (connection) connection.release();
  }
});

// Get frequent customers (for staff schedule autocomplete)
router.get("/frequent", verifyToken, async (req, res) => {
  if (req.role !== "manager" && req.role !== "staff") {
    return res.status(403).json({ message: "Manager or staff role required" });
  }
  let connection;
  try {
    connection = await pool.getConnection();
    const [results] = await connection.query(
      `SELECT u.id, u.fullname as name, u.username, u.email, u.phone_number as phone, COUNT(b.id) as booking_count
       FROM users u 
       JOIN bookings b ON u.id = b.user_id 
       WHERE u.role = 'customer' 
       GROUP BY u.id, u.fullname, u.username, u.email, u.phone_number 
       ORDER BY booking_count DESC, u.fullname ASC 
       LIMIT 10`,
      []
    );
    console.log("Fetched frequent customers:", results.length);
    res.json(results);
  } catch (err) {
    console.error("Error fetching frequent customers:", err.message);
    res.status(500).json({ message: "Server error", detail: err.message });
  } finally {
    if (connection) connection.release();
  }
});

module.exports = router;
