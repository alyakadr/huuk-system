const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const bookingController = require("../controllers/bookingController");
const paymentController = require("../utils/payment");
const { sendBookingReceipt } = require("../utils/email");
const pool = require("../config/db");

const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  console.log("[BOOKING ROUTES] Authorization header:", authHeader);
  
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    console.log("[BOOKING ROUTES] No token provided or invalid format");
    return res.status(401).json({ message: "No token provided" });
  }
  
  const token = authHeader.split(" ")[1];
  console.log("[BOOKING ROUTES] Token extracted:", token);
  
  if (!token) {
    console.log("[BOOKING ROUTES] No token found after split");
    return res.status(401).json({ message: "No token provided" });
  }
  
  jwt.verify(token, process.env.JWT_SECRET || "your_jwt_secret_key", (err, decoded) => {
    if (err) {
      console.log("[BOOKING ROUTES] Token verification error:", err.message);
      return res.status(401).json({ message: "Invalid token" });
    }
    
    console.log("[BOOKING ROUTES] Decoded token:", decoded);
    
    if (!decoded.userId || !decoded.role) {
      console.log("[BOOKING ROUTES] Invalid token payload, missing userId or role");
      return res.status(401).json({ message: "Invalid token payload" });
    }
    
    req.userId = String(decoded.userId);
    req.role = decoded.role;
    console.log("[BOOKING ROUTES] User role:", req.role, "User ID:", req.userId);
    next();
  });
};

router.get("/outlets", bookingController.getOutlets);
router.get("/services", bookingController.getServices);
router.get("/available-slots", bookingController.getAvailableSlots);
router.get("/available-staff", bookingController.getAvailableStaff);
router.get("/staff-by-time", bookingController.getStaffByTime);
// Public: allow fetching bookings for a date/outlet (for time slot filtering)
router.get("/", (req, res, next) => {
  if (req.query.date && req.query.outlet_id) {
    // Public access for time slot filtering
    return bookingController.getBookingsForDateOutlet(req, res, next);
  }
  // Otherwise, require authentication for user-specific bookings
  verifyToken(req, res, () => bookingController.getUserBookings(req, res, next));
});
// Enhanced booking creation route with detailed logging
router.post("/", verifyToken, (req, res, next) => {
  console.log("\n=== BOOKING CREATION REQUEST DEBUG ===");
  console.log("[BOOKING ROUTES] Full request body:", JSON.stringify(req.body, null, 2));
  console.log("[BOOKING ROUTES] Request headers:", JSON.stringify(req.headers, null, 2));
  console.log("[BOOKING ROUTES] Content-Type:", req.headers['content-type']);
  console.log("[BOOKING ROUTES] User ID from token:", req.userId);
  console.log("[BOOKING ROUTES] User role from token:", req.role);
  console.log("[BOOKING ROUTES] Request method:", req.method);
  console.log("[BOOKING ROUTES] Request URL:", req.url);
  console.log("[BOOKING ROUTES] Request params:", JSON.stringify(req.params, null, 2));
  console.log("[BOOKING ROUTES] Request query:", JSON.stringify(req.query, null, 2));
  
  // Log each field individually for better visibility
  const fields = ['outlet_id', 'service_id', 'staff_id', 'date', 'time', 'customer_name', 'customer_phone', 'notes', 'duration_minutes', 'price'];
  console.log("[BOOKING ROUTES] Individual field analysis:");
  fields.forEach(field => {
    const value = req.body[field];
    console.log(`  - ${field}: ${JSON.stringify(value)} (type: ${typeof value})`);
  });
  
  // Check for required fields
  const requiredFields = ['outlet_id', 'service_id', 'staff_id', 'date', 'time', 'customer_name'];
  console.log("[BOOKING ROUTES] Required field validation:");
  const missingFields = [];
  requiredFields.forEach(field => {
    const value = req.body[field];
    const isPresent = value !== undefined && value !== null && value !== '';
    console.log(`  - ${field}: ${isPresent ? 'PRESENT' : 'MISSING'} (value: ${JSON.stringify(value)})`);
    if (!isPresent) {
      missingFields.push(field);
    }
  });
  
  if (missingFields.length > 0) {
    console.log("[BOOKING ROUTES] VALIDATION FAILED - Missing required fields:", missingFields);
    return res.status(400).json({ 
      message: "Missing required fields", 
      missingFields: missingFields,
      receivedData: req.body 
    });
  }
  
  console.log("[BOOKING ROUTES] All required fields present, proceeding to controller...");
  console.log("=== END BOOKING DEBUG ===");
  
  next();
}, bookingController.createBooking);
router.put("/:bookingId", verifyToken, bookingController.updateBooking);
router.post("/:bookingId/finalize", verifyToken, bookingController.finalizeBooking);
router.post("/cancel", verifyToken, bookingController.cancelBooking);
router.delete("/:bookingId", verifyToken, bookingController.deleteBooking);
router.post("/send-receipt/:bookingId", verifyToken, async (req, res) => {
  const { bookingId } = req.params;
  let connection;
  try {
    connection = await pool.getConnection();
    const [bookingDetails] = await connection.query(
      `SELECT b.id, o.shortform AS outlet, s.name AS service, s.price, b.date, b.time, b.customer_name, u.fullname AS staff_name
       FROM bookings b
       JOIN outlets o ON b.outlet_id = o.id
       JOIN services s ON b.service_id = s.id
       JOIN users u ON b.staff_id = u.id
       WHERE b.id = ? AND b.user_id = ?`,
      [bookingId, req.userId]
    );
    const [user] = await connection.query(
      "SELECT email FROM users WHERE id = ?",
      [req.userId]
    );
    if (bookingDetails.length && user.length) {
      await sendBookingReceipt(
        {
          id: bookingDetails[0].id,
          outlet: bookingDetails[0].outlet,
          service: bookingDetails[0].service,
          date: bookingDetails[0].date,
          time: bookingDetails[0].time,
          customer_name: bookingDetails[0].customer_name,
          staff_name: bookingDetails[0].staff_name,
          price: parseFloat(bookingDetails[0].price),
          currency: "MYR",
          payment_method: "Online Payment",
          payment_status: "Paid",
        },
        user[0].email
      );
      res.json({ message: "Receipt sent" });
    } else {
      res.status(404).json({ message: "Booking or user not found" });
    }
  } catch (err) {
    console.error("Error sending receipt:", err.message);
    res.status(500).json({ message: "Server error" });
  } finally {
    if (connection) connection.release();
  }
});
router.post(
  "/set-pay-at-outlet",
  verifyToken,
  bookingController.setPayAtOutlet
);
router.get("/staff/sales", verifyToken, bookingController.getStaffSales);
router.get("/staff/payments", verifyToken, bookingController.getStaffPayments);
router.get("/manager/sales", verifyToken, bookingController.getManagerSales);
router.get(
  "/manager/payments",
  verifyToken,
  bookingController.getManagerPayments
);
router.post("/block-time", verifyToken, bookingController.blockTime);
router.get("/blocked-times", verifyToken, bookingController.getBlockedTimes);
router.post("/reviews", verifyToken, bookingController.submitReview);
router.get("/reviews/:booking_id", verifyToken, bookingController.getReview);
router.patch("/reviews/:id", verifyToken, bookingController.updateReview);
router.post("/reschedule", verifyToken, bookingController.rescheduleBooking);
router.post(
  "/payments/create-session",
  verifyToken,
  paymentController.createSession
);
router.post(
  "/payments/update-status",
  verifyToken,
  paymentController.updateStatus
);
router.get(
  "/payments/status/:sessionId",
  verifyToken,
  paymentController.checkStatus
);

router.get("/staff/schedule", verifyToken, bookingController.getStaffSchedule);
router.get("/staff/appointments", verifyToken, bookingController.getStaffAppointments);
router.put("/staff/appointment/:id/status", verifyToken, bookingController.updateAppointmentStatus);
router.put("/staff/appointment/:id/reschedule", verifyToken, bookingController.rescheduleStaffAppointment);
router.delete("/staff/appointment/:id", verifyToken, bookingController.cancelStaffAppointment);
router.post("/staff/appointment", verifyToken, bookingController.createStaffAppointment);
router.post("/staff/mark-done", verifyToken, bookingController.markBookingDone);
router.post("/staff/mark-absent", verifyToken, bookingController.markBookingAbsent);
router.get("/booking-details/:id", verifyToken, bookingController.getBookingDetails);

// New route for total appointments yesterday
router.get(
  "/appointments/total-yesterday",
  verifyToken,
  bookingController.getTotalAppointmentsYesterday
);

// Add to bookingRoutes.js
router.get(
  "/appointments/all",
  verifyToken,
  bookingController.getAllAppointments
);
router.get(
  "/appointments/total-today",
  verifyToken,
  bookingController.getTotalAppointmentsToday
);

router.get("/staff/bookings", verifyToken, bookingController.getStaffBookings);

// Additional route without /api prefix for compatibility
router.get("/staff/bookings", verifyToken, bookingController.getStaffBookings);

// Route to get bookings by phone number (for returning customers)
router.get("/by-phone/:phoneNumber", verifyToken, bookingController.getBookingsByPhone);

// Route to get appointments by user ID
router.get("/staff/appointments/by-user/:userId", verifyToken, bookingController.getAppointmentsByUserId);

// Summary statistics for dashboard
router.get("/summary", verifyToken, bookingController.getStaffSummary);

// Today's appointments by staff for bar chart
router.get("/todays-appointments-by-staff", verifyToken, bookingController.getTodaysAppointmentsByStaff);

// Sales report for today's completed bookings (for pie chart)
router.get("/sales-report", verifyToken, bookingController.getSalesReport);

// Daily transactions by outlet for transaction chart
router.get("/daily-transactions", verifyToken, bookingController.getTodayTransactionsByOutlet);

// Customer satisfaction ratings for manager dashboard
router.get("/customer-satisfaction", verifyToken, bookingController.getCustomerSatisfactionRatings);

// Manager reschedule and cancel appointment routes
router.put("/manager/appointment/:id/reschedule", verifyToken, bookingController.managerRescheduleAppointment);
router.put("/manager/appointment/:id/cancel", verifyToken, bookingController.managerCancelAppointment);

module.exports = router;
