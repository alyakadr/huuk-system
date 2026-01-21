const express = require("express");
const router = express.Router();
const mysql = require("mysql2/promise");
const path = require("path");
const fs = require("fs");
const moment = require("moment");
const { attendanceUpload } = require("../middlewares/uploadMiddleware");

// MySQL Connection Pool (from app.js)
const pool = require("../config/db");

const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) {
    console.error("No token provided");
    return res.status(401).json({ message: "No token provided" });
  }
  const jwt = require("jsonwebtoken");
  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      console.error("Token verification error:", err.message);
      return res.status(401).json({ message: "Invalid or expired token" });
    }
    req.userId = String(decoded.userId);
    req.role = decoded.role;
    next();
  });
};

// GET /users/attendance (supports staff_id, outlet, date, or date-only filters)
router.get("/attendance", verifyToken, async (req, res) => {
  let connection;
  try {
    const { staff_id, outlet, date, page = 1, all } = req.query;
    const limit = 10;
    const offset = (page - 1) * limit;

    if (!staff_id && !outlet && !date) {
      return res.status(400).json({ message: "At least one filter required" });
    }

    let query = `
      SELECT a.id, a.staff_id, u.fullname, u.outlet, a.time_in, a.time_out, 
             a.created_at AS created_date, a.document_path, a.remarks
      FROM attendance a
      JOIN users u ON a.staff_id = u.id
      WHERE 1=1
    `;
    const params = [];

    if (staff_id) {
      query += " AND a.staff_id = ?";
      params.push(staff_id);
    }
    if (outlet) {
      query += " AND u.outlet = ?";
      params.push(outlet);
    }
    if (date) {
      query += " AND DATE(a.created_at) = ?";
      params.push(date);
    }

    query += " ORDER BY a.created_at DESC";
    
    // Add pagination only if not requesting all records
    if (all !== 'true') {
      query += " LIMIT ? OFFSET ?";
      params.push(limit, offset);
    }

    connection = await pool.getConnection();
    const [rows] = await connection.query(query, params);

    // Calculate total count for pagination info
    let total = rows.length;
    let totalPages = 1;
    
    if (all !== 'true') {
      const countQuery = `
        SELECT COUNT(*) AS total
        FROM attendance a
        JOIN users u ON a.staff_id = u.id
        WHERE 1=1
        ${staff_id ? "AND a.staff_id = ?" : ""}
        ${outlet ? "AND u.outlet = ?" : ""}
        ${date ? "AND DATE(a.created_at) = ?" : ""}
      `;
      const countParams = params.slice(0, params.length - 2);
      const [countRows] = await connection.query(countQuery, countParams);
      total = countRows[0].total;
      totalPages = Math.ceil(total / limit);
    }

    res.json({ attendance: rows, page: Number(page), totalPages, total });
  } catch (error) {
    console.error("Error fetching attendance:", error.message);
    res.status(500).json({ message: "Server error", error: error.message });
  } finally {
    if (connection) connection.release();
  }
});

// POST /users/attendance (log time-in or time-out)
router.post("/attendance", verifyToken, async (req, res) => {
  let connection;
  try {
    const { staff_id, time_in, time_out } = req.body;
    if (!staff_id || (!time_in && !time_out)) {
      return res
        .status(400)
        .json({ message: "staff_id and either time_in or time_out required" });
    }
    if (staff_id !== req.userId && req.role !== "manager") {
      return res
        .status(403)
        .json({ message: "Cannot log attendance for another user" });
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [userRows] = await connection.query(
      "SELECT id, outlet, isApproved, role FROM users WHERE id = ?",
      [staff_id]
    );
    if (userRows.length === 0) {
      throw new Error("User not found");
    }
    const user = userRows[0];
    if (!["staff", "manager"].includes(user.role) || !user.isApproved) {
      throw new Error("User not authorized to log attendance");
    }

    const today = moment().format("YYYY-MM-DD");
    const [existingRows] = await connection.query(
      "SELECT id, time_in, time_out FROM attendance WHERE staff_id = ? AND DATE(created_at) = ?",
      [staff_id, today]
    );

    let query, params;
    if (existingRows.length > 0) {
      const record = existingRows[0];
      if (time_in && record.time_in) {
        throw new Error("Time In already logged for today");
      }
      if (time_out && !record.time_in) {
        throw new Error("Cannot log Time Out without Time In");
      }
      if (time_out && record.time_out) {
        throw new Error("Time Out already logged for today");
      }

      query = `
        UPDATE attendance 
        SET time_out = ?, created_at = NOW()
        WHERE id = ?
      `;
      params = [time_out, record.id];
    } else {
      if (time_out && !time_in) {
        throw new Error("Cannot log Time Out without Time In");
      }
      query = `
        INSERT INTO attendance (staff_id, time_in, created_at, outlet)
        VALUES (?, ?, NOW(), ?)
      `;
      params = [staff_id, time_in, user.outlet];
    }

    const [result] = await connection.query(query, params);
    const recordId =
      existingRows.length > 0 ? existingRows[0].id : result.insertId;

    const [newRecord] = await connection.query(
      "SELECT id, staff_id, time_in, time_out, created_at, outlet FROM attendance WHERE id = ?",
      [recordId]
    );

    await connection.commit();

    // Emit WebSocket message
    const io = req.app.get("socketio");
    if (io) {
      io.emit("attendanceUpdate", {
        staff_id: newRecord[0].staff_id,
        outlet: newRecord[0].outlet,
        time_in: newRecord[0].time_in
          ? moment(newRecord[0].time_in).format("YYYY-MM-DD HH:mm:ss")
          : null,
        time_out: newRecord[0].time_out
          ? moment(newRecord[0].time_out).format("YYYY-MM-DD HH:mm:ss")
          : null,
        created_date: moment(newRecord[0].created_at).format(
          "YYYY-MM-DD HH:mm:ss"
        ),
      });
    }

    res.status(200).json(newRecord[0]);
  } catch (error) {
    if (connection) await connection.rollback();
    console.error("Error logging attendance:", error.message);
    res.status(400).json({ message: error.message });
  } finally {
    if (connection) connection.release();
  }
});

// POST /users/attendance/new-day (create new day attendance record)
router.post("/attendance/new-day", verifyToken, async (req, res) => {
  let connection;
  try {
    const { staff_id } = req.body;
    if (!staff_id) {
      return res.status(400).json({ message: "staff_id required" });
    }
    // Allow both staff and manager roles
    if (staff_id !== req.userId && req.role !== "manager") {
      return res.status(403).json({ message: "Cannot create attendance for another user. Only staff or manager can create their own attendance record." });
    }
    if (!["staff", "manager"].includes(req.role)) {
      return res.status(403).json({ message: "Only staff or manager role can create attendance records." });
    }

    connection = await pool.getConnection();
    
    const today = moment().format("YYYY-MM-DD");
    const [existingRows] = await connection.query(
      "SELECT id FROM attendance WHERE staff_id = ? AND DATE(created_at) = ?",
      [staff_id, today]
    );
    
    if (existingRows.length > 0) {
      return res.status(400).json({ message: "Attendance record already exists for today" });
    }
    
    const [userRows] = await connection.query(
      "SELECT outlet FROM users WHERE id = ?",
      [staff_id]
    );
    
    if (userRows.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }
    
    const [result] = await connection.query(
      "INSERT INTO attendance (staff_id, created_at, outlet) VALUES (?, NOW(), ?)",
      [staff_id, userRows[0].outlet]
    );
    
    const [newRecord] = await connection.query(
      "SELECT id, staff_id, time_in, time_out, created_at, outlet FROM attendance WHERE id = ?",
      [result.insertId]
    );
    
    res.status(201).json(newRecord[0]);
  } catch (error) {
    console.error("Error creating new day record:", error.message);
    res.status(500).json({ message: "Server error", error: error.message });
  } finally {
    if (connection) connection.release();
  }
});

// POST /users/upload (upload document for attendance)
router.post("/upload", verifyToken, attendanceUpload.single("file"), async (req, res) => {
  let connection;
  try {
    const { attendance_id, reason } = req.body;
    if (!req.file || !attendance_id || !reason) {
      return res
        .status(400)
        .json({ message: "File, attendance_id, and reason required" });
    }

    const filePath = `/Uploads/attendance/${req.file.filename}`;
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [attendanceRows] = await connection.query(
      "SELECT staff_id, time_in, time_out, created_at FROM attendance WHERE id = ?",
      [attendance_id]
    );
    if (attendanceRows.length === 0) {
      throw new Error("Attendance record not found");
    }
    const attendance = attendanceRows[0];
    if (attendance.staff_id !== req.userId && req.role !== "manager") {
      throw new Error("Cannot upload for another user's attendance");
    }
    const attendanceDate = moment(attendance.created_at).format("YYYY-MM-DD");
    const thresholdDate = moment(attendanceDate).add(3, "days");
    if (moment().isAfter(thresholdDate)) {
      throw new Error("Upload period expired (3 days after attendance date)");
    }
    if (attendance.time_in && attendance.time_out) {
      throw new Error("Cannot upload for completed attendance");
    }

    const [existingUploads] = await connection.query(
      "SELECT COUNT(*) AS count FROM attendance WHERE id = ? AND document_path IS NOT NULL",
      [attendance_id]
    );
    if (existingUploads[0].count >= 2) {
      throw new Error("Maximum uploads reached for this attendance record");
    }

    const query = `
      UPDATE attendance 
      SET document_path = ?, remarks = ?
      WHERE id = ?
    `;
    await connection.query(query, [
      filePath,
      `Absent with notice (${reason})`,
      attendance_id,
    ]);
    await connection.commit();

    res
      .status(200)
      .json({ filePath, message: "Document uploaded successfully" });
  } catch (error) {
    if (connection) await connection.rollback();
    if (req.file) {
      fs.unlink(path.join(__dirname, "..", req.file.path), (err) => {
        if (err) console.error("Error deleting file:", err.message);
      });
    }
    console.error("Error uploading document:", error.message);
    res.status(400).json({ message: error.message });
  } finally {
    if (connection) connection.release();
  }
});

module.exports = router;
