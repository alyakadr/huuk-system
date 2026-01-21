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

router.get("/total-revenue-today", verifyToken, async (req, res) => {
  if (req.role !== "manager") {
    return res.status(403).json({ message: "Manager role required" });
  }
  let connection;
  try {
    connection = await pool.getConnection();
    const today = moment().format("YYYY-MM-DD");
    const [results] = await connection.query(
      `SELECT SUM(s.price) AS total
       FROM bookings b
       JOIN services s ON b.service_id = s.id
       WHERE b.date = ? AND b.payment_status = 'Paid'`,
      [today]
    );
    const total = results[0].total || 0;
    console.log("Fetched total revenue for today:", total);
    res.json({ total });
  } catch (err) {
    console.error("Error fetching total revenue today:", err.message);
    res.status(500).json({ message: "Server error", detail: err.message });
  } finally {
    if (connection) connection.release();
  }
});

router.get("/total-revenue-yesterday", verifyToken, async (req, res) => {
  if (req.role !== "manager") {
    return res.status(403).json({ message: "Manager role required" });
  }
  let connection;
  try {
    connection = await pool.getConnection();
    const yesterday = moment().subtract(1, "days").format("YYYY-MM-DD");
    const [results] = await connection.query(
      `SELECT SUM(s.price) AS total
       FROM bookings b
       JOIN services s ON b.service_id = s.id
       WHERE b.date = ? AND b.payment_status = 'Paid'`,
      [yesterday]
    );
    const total = results[0].total || 0;
    console.log("Fetched total revenue for yesterday:", total);
    res.json({ total });
  } catch (err) {
    console.error("Error fetching total revenue yesterday:", err.message);
    res.status(500).json({ message: "Server error", detail: err.message });
  } finally {
    if (connection) connection.release();
  }
});

// Payment management endpoint for staff dashboard
router.get("/payment-management", verifyToken, async (req, res) => {
  if (req.role !== "staff" && req.role !== "manager") {
    return res.status(403).json({ message: "Staff or manager role required" });
  }
  let connection;
  try {
    connection = await pool.getConnection();
    const today = moment().format("YYYY-MM-DD");
    const [results] = await connection.query(
      `SELECT b.id, b.customer_name, b.payment_method, b.payment_status
       FROM bookings b
       LEFT JOIN users u ON b.user_id = u.id
       WHERE b.status IN ('Pending', 'Completed', 'Confirmed', 'Rescheduled', 'Absent', 'Cancelled')
       AND b.payment_status IN ('Pending', 'Paid', 'Unpaid')
       AND u.id IS NOT NULL
       AND (
         u.role = 'customer'
         OR u.role IN ('staff', 'manager')
       )
       ORDER BY b.created_at DESC
       LIMIT 3`
    );
    
    const formattedResults = results.map((payment) => ({
      id: payment.id,
      customer_name: payment.customer_name || "-",
      payment_method: payment.payment_method === "Stripe" ? "Online payment" : (payment.payment_method || "-"),
      payment_status: payment.payment_status || "Pending",
    }));
    
    console.log("Fetched payment management data:", formattedResults);
    res.json(formattedResults);
  } catch (err) {
    console.error("Error fetching payment management data:", err.message);
    res.status(500).json({ message: "Server error", detail: err.message });
  } finally {
    if (connection) connection.release();
  }
});

// Update payment status endpoint
router.post("/update-payment-status", verifyToken, async (req, res) => {
  if (req.role !== "staff" && req.role !== "manager") {
    return res.status(403).json({ message: "Staff or manager role required" });
  }
  
  console.log("=== Payment Status Update Request ===");
  console.log("Request body:", req.body);
  console.log("User role:", req.role);
  console.log("User ID:", req.userId);
  
  const { booking_id, payment_status } = req.body;
  
  console.log("Extracted booking_id:", booking_id, "(type:", typeof booking_id, ")");
  console.log("Extracted payment_status:", payment_status, "(type:", typeof payment_status, ")");
  
  if (!booking_id || !payment_status) {
    console.log("❌ Missing required fields - booking_id:", !!booking_id, "payment_status:", !!payment_status);
    return res.status(400).json({ message: "Booking ID and payment status are required" });
  }
  
  if (!['Paid', 'Unpaid', 'Pending'].includes(payment_status)) {
    console.log("❌ Invalid payment status:", payment_status);
    return res.status(400).json({ message: "Invalid payment status. Must be 'Paid', 'Unpaid', or 'Pending'" });
  }
  
  let connection;
  try {
    connection = await pool.getConnection();
    
    // Check if booking exists and has pay_at_outlet payment method
    const [booking] = await connection.query(
      "SELECT id, payment_method FROM bookings WHERE id = ?",
      [booking_id]
    );
    
    console.log("Database query result:", booking);
    console.log("Booking found:", booking.length > 0);
    
    if (!booking.length) {
      console.log("❌ Booking not found for ID:", booking_id);
      return res.status(404).json({ message: "Booking not found" });
    }
    
    console.log("Found booking:", booking[0]);
    console.log("Payment method comparison:", {
      actual: booking[0].payment_method,
      expected: 'Pay at Outlet',
      match: booking[0].payment_method === 'Pay at Outlet'
    });
    
    // Allow null/empty payment_method as 'Pay at Outlet'
    if (booking[0].payment_method !== 'Pay at Outlet' && booking[0].payment_method !== null && booking[0].payment_method !== '') {
      console.log("❌ Invalid payment method:", booking[0].payment_method);
      return res.status(400).json({ message: "Payment status can only be updated for pay at outlet bookings" });
    }
    
    // Update payment status
    await connection.query(
      "UPDATE bookings SET payment_status = ? WHERE id = ?",
      [payment_status, booking_id]
    );
    
    console.log(`Payment status updated for booking ${booking_id} to ${payment_status}`);
    res.json({ message: "Payment status updated successfully" });
  } catch (err) {
    console.error("Error updating payment status:", err.message);
    res.status(500).json({ message: "Server error", detail: err.message });
  } finally {
    if (connection) connection.release();
  }
});

module.exports = router;
