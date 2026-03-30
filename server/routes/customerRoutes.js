const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const moment = require("moment");
const mongoose = require("mongoose");
const User = require("../models/User");
const Booking = require("../models/Booking");
const { attachJwtUserIds } = require("../utils/attachJwtUser");

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error("JWT_SECRET not set");
  process.exit(1);
}

const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
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

router.get("/total-all", verifyToken, async (req, res) => {
  if (req.role !== "manager") {
    return res.status(403).json({ message: "Manager role required" });
  }
  try {
    const count = await User.countDocuments({ role: "customer" });
    res.json({ count });
  } catch (err) {
    console.error("Error fetching total customers:", err.message);
    res.status(500).json({ message: "Server error", detail: err.message });
  }
});

router.get("/total-up-to-yesterday", verifyToken, async (req, res) => {
  if (req.role !== "manager") {
    return res.status(403).json({ message: "Manager role required" });
  }
  try {
    const startOfToday = moment().startOf("day").toDate();
    const count = await User.countDocuments({
      role: "customer",
      createdAt: { $lt: startOfToday },
    });
    res.json({ count });
  } catch (err) {
    console.error("Error fetching customers up to yesterday:", err.message);
    res.status(500).json({ message: "Server error", detail: err.message });
  }
});

router.get("/list", verifyToken, async (req, res) => {
  if (req.role !== "manager") {
    return res.status(403).json({ message: "Manager role required" });
  }
  try {
    const customers = await User.find({ role: "customer" })
      .select("_id fullname username email createdAt")
      .sort({ createdAt: -1 })
      .lean();
    res.json(
      customers.map((u) => ({
        id: u._id.toString(),
        fullname: u.fullname,
        username: u.username,
        email: u.email,
        created_at: u.createdAt,
      }))
    );
  } catch (err) {
    console.error("Error fetching customer list:", err.message);
    res.status(500).json({ message: "Server error", detail: err.message });
  }
});

router.get("/recent", verifyToken, async (req, res) => {
  if (req.role !== "manager" && req.role !== "staff") {
    return res.status(403).json({ message: "Manager or staff role required" });
  }
  try {
    const customers = await User.find({ role: "customer" })
      .select("_id fullname username email phone_number")
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();
    res.json(
      customers.map((u) => ({
        id: u._id.toString(),
        fullname: u.fullname,
        username: u.username,
        email: u.email,
        phone_number: u.phone_number,
      }))
    );
  } catch (err) {
    console.error("Error fetching recent customers:", err.message);
    res.status(500).json({ message: "Server error", detail: err.message });
  }
});

router.get("/search", verifyToken, async (req, res) => {
  if (req.role !== "manager" && req.role !== "staff") {
    return res.status(403).json({ message: "Manager or staff role required" });
  }
  const { q } = req.query;
  if (!q || q.trim().length < 2) {
    return res.status(400).json({ message: "Search query must be at least 2 characters long" });
  }
  try {
    const term = q.trim();
    const rx = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    const customers = await User.find({
      role: "customer",
      $or: [{ fullname: rx }, { username: rx }, { email: rx }],
    })
      .select("_id fullname username email phone_number")
      .sort({ fullname: 1 })
      .limit(20)
      .lean();
    res.json(
      customers.map((u) => ({
        id: u._id.toString(),
        fullname: u.fullname,
        username: u.username,
        email: u.email,
        phone_number: u.phone_number,
      }))
    );
  } catch (err) {
    console.error("Error searching customers:", err.message);
    res.status(500).json({ message: "Server error", detail: err.message });
  }
});

router.get("/today", verifyToken, async (req, res) => {
  if (req.role !== "manager" && req.role !== "staff") {
    return res.status(403).json({ message: "Manager or staff role required" });
  }
  const { date } = req.query;
  if (!date) {
    return res.status(400).json({ message: "Date parameter is required" });
  }
  try {
    const userIds = await Booking.distinct("user_id", { date });
    const validIds = userIds.filter((id) => id != null);
    if (!validIds.length) {
      return res.json([]);
    }
    const customers = await User.find({
      _id: { $in: validIds },
      role: "customer",
    })
      .select("_id fullname username email phone_number")
      .sort({ fullname: 1 })
      .limit(10)
      .lean();
    res.json(
      customers.map((u) => ({
        id: u._id.toString(),
        name: u.fullname,
        username: u.username,
        email: u.email,
        phone: u.phone_number,
      }))
    );
  } catch (err) {
    console.error("Error fetching today's customers:", err.message);
    res.status(500).json({ message: "Server error", detail: err.message });
  }
});

router.get("/frequent", verifyToken, async (req, res) => {
  if (req.role !== "manager" && req.role !== "staff") {
    return res.status(403).json({ message: "Manager or staff role required" });
  }
  try {
    const pipeline = [
      { $match: { user_id: { $ne: null } } },
      { $group: { _id: "$user_id", booking_count: { $sum: 1 } } },
      { $sort: { booking_count: -1 } },
      { $limit: 10 },
    ];
    const grouped = await Booking.aggregate(pipeline);
    const ids = grouped.map((g) => g._id).filter((id) => mongoose.Types.ObjectId.isValid(id));
    if (!ids.length) {
      return res.json([]);
    }
    const users = await User.find({ _id: { $in: ids }, role: "customer" })
      .select("_id fullname username email phone_number")
      .lean();
    const byId = new Map(users.map((u) => [u._id.toString(), u]));
    const ordered = grouped
      .map((g) => {
        const u = byId.get(g._id.toString());
        if (!u) return null;
        return {
          id: u._id.toString(),
          name: u.fullname,
          username: u.username,
          email: u.email,
          phone: u.phone_number,
          booking_count: g.booking_count,
        };
      })
      .filter(Boolean);
    res.json(ordered);
  } catch (err) {
    console.error("Error fetching frequent customers:", err.message);
    res.status(500).json({ message: "Server error", detail: err.message });
  }
});

module.exports = router;
