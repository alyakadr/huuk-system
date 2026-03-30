const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const BlockedSlot = require("../models/BlockedSlot");
const { attachJwtUserIds } = require("../utils/attachJwtUser");

function parseStaffObjectId(staffId, res) {
  if (!staffId) return null;
  if (!mongoose.Types.ObjectId.isValid(staffId)) {
    res.status(400).json({ message: "Invalid staff_id" });
    return null;
  }
  return new mongoose.Types.ObjectId(staffId);
}

const JWT_SECRET = process.env.JWT_SECRET || "your_jwt_secret_key";

const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "No token provided" });
  }
  const token = authHeader.split(" ")[1];
  if (!token) {
    return res.status(401).json({ message: "No token provided" });
  }
  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).json({ message: "Invalid or expired token" });
    }
    if (!decoded.userId || !decoded.role) {
      return res.status(401).json({ message: "Invalid token payload" });
    }
    if (!attachJwtUserIds(req, decoded.userId)) {
      return res.status(401).json({ message: "Invalid token payload" });
    }
    req.role = decoded.role;
    next();
  });
};

function formatTimeSlot(timeSlot) {
  if (typeof timeSlot === "string") {
    return timeSlot.substring(0, 5);
  }
  return timeSlot;
}

router.get("/blocked-slots", verifyToken, async (req, res) => {
  const { staff_id, date, startDate, endDate } = req.query;

  let filter;
  if (date) {
    const staffObjectId = parseStaffObjectId(staff_id || req.userId, res);
    if (!staffObjectId) return;
    filter = {
      staff_id: staffObjectId,
      date,
      is_active: true,
    };
  } else if (startDate && endDate) {
    const staffObjectId = parseStaffObjectId(req.userId, res);
    if (!staffObjectId) return;
    filter = {
      staff_id: staffObjectId,
      date: { $gte: startDate, $lte: endDate },
      is_active: true,
    };
  } else {
    return res.status(400).json({
      message: "Either 'date' or both 'startDate' and 'endDate' are required parameters",
    });
  }

  try {
    const rows = await BlockedSlot.find(filter).select("date time_slot staff_id").lean();

    if (date) {
      const blocked_slots = rows.map((row) => ({
        time: formatTimeSlot(row.time_slot),
        staff_id: row.staff_id.toString(),
      }));
      res.json({ success: true, blocked_slots });
      return;
    }

    const blockedSlots = rows.map((row) => {
      const slotDate = new Date(row.date);
      const dayIndex = slotDate.getDay();
      const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      const dayDisplay = `${dayNames[dayIndex]} ${slotDate.getDate()}`;
      return {
        day: dayDisplay,
        time: formatTimeSlot(row.time_slot),
        staff_id: row.staff_id.toString(),
      };
    });
    res.json(blockedSlots);
  } catch (error) {
    console.error("Error fetching blocked slots:", error);
    res.status(500).json({ message: "Server error", detail: error.message });
  }
});

router.post("/toggle-slot-blocking", verifyToken, async (req, res) => {
  const { staff_id, date, time, action } = req.body;

  if (!staff_id || !date || !time || !action) {
    return res.status(400).json({ message: "staff_id, date, time, and action are required" });
  }

  if (!["block", "unblock"].includes(action)) {
    return res.status(400).json({ message: "action must be either 'block' or 'unblock'" });
  }

  try {
    const staffObjectId = parseStaffObjectId(staff_id, res);
    if (!staffObjectId) return;

    if (action === "block") {
      await BlockedSlot.findOneAndUpdate(
        { staff_id: staffObjectId, date, time_slot: time },
        { staff_id: staffObjectId, date, time_slot: time, is_active: true },
        { upsert: true, new: true }
      );
    } else {
      await BlockedSlot.findOneAndUpdate(
        { staff_id: staffObjectId, date, time_slot: time },
        { is_active: false }
      );
    }

    res.json({
      success: true,
      message: `Slot ${action}ed successfully`,
      staff_id: staffObjectId.toString(),
      date,
      time,
      action,
    });
  } catch (error) {
    console.error("Error toggling slot blocking:", error);
    res.status(500).json({ message: "Server error", detail: error.message });
  }
});

module.exports = router;
