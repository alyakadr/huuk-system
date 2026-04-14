const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const moment = require("moment");
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

async function sumPaidRevenueForDate(dateStr) {
  const agg = await Booking.aggregate([
    { $match: { date: dateStr, payment_status: "Paid" } },
    {
      $lookup: {
        from: "services",
        localField: "service_id",
        foreignField: "_id",
        as: "svc",
      },
    },
    { $unwind: { path: "$svc", preserveNullAndEmptyArrays: true } },
    {
      $group: {
        _id: null,
        total: {
          $sum: {
            $ifNull: ["$price", { $ifNull: ["$svc.price", 0] }],
          },
        },
      },
    },
  ]);
  return agg[0]?.total ?? 0;
}

router.get("/total-revenue-today", verifyToken, async (req, res) => {
  if (req.role !== "manager") {
    return res.status(403).json({ message: "Manager role required" });
  }
  try {
    const today = moment().format("YYYY-MM-DD");
    const total = await sumPaidRevenueForDate(today);
    res.json({ total });
  } catch (err) {
    console.error("Error fetching total revenue today:", err.message);
    res.status(500).json({ message: "Server error" });
  }
});

router.get("/total-revenue-yesterday", verifyToken, async (req, res) => {
  if (req.role !== "manager") {
    return res.status(403).json({ message: "Manager role required" });
  }
  try {
    const yesterday = moment().subtract(1, "days").format("YYYY-MM-DD");
    const total = await sumPaidRevenueForDate(yesterday);
    res.json({ total });
  } catch (err) {
    console.error("Error fetching total revenue yesterday:", err.message);
    res.status(500).json({ message: "Server error" });
  }
});

const BOOKING_STATUS_FILTER = [
  "Pending",
  "Completed",
  "Confirmed",
  "Rescheduled",
  "Absent",
  "Cancelled",
];

router.get("/payment-management", verifyToken, async (req, res) => {
  if (req.role !== "staff" && req.role !== "manager") {
    return res.status(403).json({ message: "Staff or manager role required" });
  }
  try {
    const candidates = await Booking.find({
      status: { $in: BOOKING_STATUS_FILTER },
      payment_status: { $in: ["Pending", "Paid", "Unpaid"] },
      user_id: { $ne: null },
    })
      .populate({ path: "user_id", select: "role" })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    const filtered = candidates.filter((b) => {
      const role = b.user_id?.role;
      return role === "customer" || role === "staff" || role === "manager";
    });

    const formatted = filtered.slice(0, 3).map((payment) => ({
      id: payment._id.toString(),
      customer_name: payment.customer_name || "-",
      payment_method: payment.payment_method === "Stripe" ? "Online payment" : payment.payment_method || "-",
      payment_status: payment.payment_status || "Pending",
    }));

    res.json(formatted);
  } catch (err) {
    console.error("Error fetching payment management data:", err.message);
    res.status(500).json({ message: "Server error" });
  }
});

router.post("/update-payment-status", verifyToken, async (req, res) => {
  if (req.role !== "staff" && req.role !== "manager") {
    return res.status(403).json({ message: "Staff or manager role required" });
  }

  const { booking_id, payment_status } = req.body;

  if (!booking_id || !payment_status) {
    return res.status(400).json({ message: "Booking ID and payment status are required" });
  }

  if (!["Paid", "Unpaid", "Pending"].includes(payment_status)) {
    return res.status(400).json({ message: "Invalid payment status. Must be 'Paid', 'Unpaid', or 'Pending'" });
  }

  try {
    const booking = await Booking.findById(booking_id).select("payment_method");
    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }

    const pm = booking.payment_method;
    const allowedPayAtOutlet = pm === "Pay at Outlet" || pm == null || pm === "";
    if (!allowedPayAtOutlet) {
      return res.status(400).json({ message: "Payment status can only be updated for pay at outlet bookings" });
    }

    await Booking.findByIdAndUpdate(booking_id, { payment_status });
    res.json({ message: "Payment status updated successfully" });
  } catch (err) {
    console.error("Error updating payment status:", err.message);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
