const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const pool = require("../config/db");

const JWT_SECRET = process.env.JWT_SECRET || "your_jwt_secret_key";

const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  console.log("[STAFF ROUTES] Authorization header:", authHeader);
  
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    console.log("[STAFF ROUTES] No token provided or invalid format");
    return res.status(401).json({ message: "No token provided" });
  }
  
  const token = authHeader.split(" ")[1];
  console.log("[STAFF ROUTES] Token extracted:", token?.substring(0, 20) + "...");
  
  if (!token) {
    console.log("[STAFF ROUTES] No token found after split");
    return res.status(401).json({ message: "No token provided" });
  }
  
  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      console.error("[STAFF ROUTES] Token verification error:", err.message);
      return res.status(401).json({ message: "Invalid or expired token" });
    }
    
    if (!decoded.userId || !decoded.role) {
      console.log("[STAFF ROUTES] Invalid token payload, missing userId or role");
      return res.status(401).json({ message: "Invalid token payload" });
    }
    
    req.userId = String(decoded.userId);
    req.role = decoded.role;
    console.log("[STAFF ROUTES] Token verified for user:", req.userId, "role:", req.role);
    next();
  });
};

// Get blocked slots for a specific staff member and date
router.get("/blocked-slots", verifyToken, async (req, res) => {
  const { staff_id, date, startDate, endDate } = req.query;
  
  console.log('📥 [GET BLOCKED SLOTS] Received request:', { staff_id, date, startDate, endDate });
  
  // Support both single date and date range queries
  let query, params;
  if (date) {
    // Single date query (from StaffAppointments.js)
    query = `SELECT date, time_slot, staff_id FROM blocked_slots 
             WHERE staff_id = ? AND date = ? AND is_active = 1`;
    params = [staff_id || req.userId, date];
  } else if (startDate && endDate) {
    // Date range query (from StaffDashboard.js)
    query = `SELECT date, time_slot, staff_id FROM blocked_slots 
             WHERE staff_id = ? AND date BETWEEN ? AND ? AND is_active = 1`;
    params = [req.userId, startDate, endDate];
  } else {
    return res.status(400).json({ 
      message: "Either 'date' or both 'startDate' and 'endDate' are required parameters" 
    });
  }

  let connection;
  try {
    connection = await pool.getConnection();
    
    const [rows] = await connection.query(query, params);
    
    console.log('📊 [GET BLOCKED SLOTS] Raw query results:', rows);
    
    if (date) {
      // For single date query, return simple array of times with staff_id
      const blockedSlots = rows.map(row => {
        const timeSlot = row.time_slot;
        const formattedTime = typeof timeSlot === 'string' ? timeSlot.substring(0, 5) : timeSlot;
        return {
          time: formattedTime,
          staff_id: row.staff_id
        };
      });
      
      console.log('📤 [GET BLOCKED SLOTS] Sending response:', { success: true, blocked_slots: blockedSlots });
      
      res.json({
        success: true,
        blocked_slots: blockedSlots
      });
    } else {
      // For date range query, return with day format for dashboard
      const blockedSlots = rows.map(row => {
        const slotDate = new Date(row.date);
        const dayIndex = slotDate.getDay();
        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const dayDisplay = `${dayNames[dayIndex]} ${slotDate.getDate()}`;
        
        const timeSlot = row.time_slot;
        const formattedTime = typeof timeSlot === 'string' ? timeSlot.substring(0, 5) : timeSlot;
        
        return {
          day: dayDisplay,
          time: formattedTime,
          staff_id: row.staff_id
        };
      });
      
      console.log('📤 [GET BLOCKED SLOTS] Sending response:', blockedSlots);
      
      res.json(blockedSlots);
    }
    
  } catch (error) {
    console.error("Error fetching blocked slots:", error);
    res.status(500).json({ 
      message: "Server error", 
      error: error.message 
    });
  } finally {
    if (connection) connection.release();
  }
});

// Toggle slot blocking/unblocking
router.post("/toggle-slot-blocking", verifyToken, async (req, res) => {
  const { staff_id, date, time, action } = req.body;
  
  if (!staff_id || !date || !time || !action) {
    return res.status(400).json({ 
      message: "staff_id, date, time, and action are required" 
    });
  }
  
  if (!['block', 'unblock'].includes(action)) {
    return res.status(400).json({ 
      message: "action must be either 'block' or 'unblock'" 
    });
  }

  let connection;
  try {
    connection = await pool.getConnection();
    
    if (action === 'block') {
      // Insert or update to block the slot
      await connection.query(
        `INSERT INTO blocked_slots (staff_id, date, time_slot, is_active, created_at, updated_at) 
         VALUES (?, ?, ?, 1, NOW(), NOW())
         ON DUPLICATE KEY UPDATE is_active = 1, updated_at = NOW()`,
        [staff_id, date, time]
      );
    } else {
      // Update to unblock the slot
      await connection.query(
        `UPDATE blocked_slots 
         SET is_active = 0, updated_at = NOW() 
         WHERE staff_id = ? AND date = ? AND time_slot = ?`,
        [staff_id, date, time]
      );
    }
    
    res.json({
      success: true,
      message: `Slot ${action}ed successfully`,
      staff_id,
      date,
      time,
      action
    });
    
  } catch (error) {
    console.error("Error toggling slot blocking:", error);
    res.status(500).json({ 
      message: "Server error", 
      error: error.message 
    });
  } finally {
    if (connection) connection.release();
  }
});

module.exports = router;
