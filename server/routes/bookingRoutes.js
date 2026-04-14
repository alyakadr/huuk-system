const express = require("express");
const router = express.Router();
const bookingController = require("../controllers/bookingController");
const paymentController = require("../utils/payment");
const { sendBookingReceipt } = require("../utils/email");
const Booking = require("../models/Booking");
const User = require("../models/User");
const verifyToken = require("../middlewares/authMiddleware");

router.get("/outlets", bookingController.getOutlets);
router.get("/services", bookingController.getServices);
router.get("/available-slots", bookingController.getAvailableSlots);
router.get("/available-staff", bookingController.getAvailableStaff);
router.get("/staff-by-time", bookingController.getStaffByTime);
router.post("/reserve-slot", verifyToken, bookingController.reserveSlot);
router.post("/release-slot", verifyToken, bookingController.releaseSlot);
router.get(
  "/check-slot-availability",
  verifyToken,
  bookingController.checkSlotAvailability,
);
// Public: allow fetching bookings for a date/outlet (for time slot filtering)
router.get("/", (req, res, next) => {
  if (req.query.date && req.query.outlet_id) {
    // Public access for time slot filtering
    return bookingController.getBookingsForDateOutlet(req, res, next);
  }
  // Otherwise, require authentication for user-specific bookings
  verifyToken(req, res, () =>
    bookingController.getUserBookings(req, res, next),
  );
});
// Enhanced booking creation route with detailed logging
router.post("/", verifyToken, bookingController.createBooking);
router.put("/:bookingId", verifyToken, bookingController.updateBooking);
router.post(
  "/:bookingId/finalize",
  verifyToken,
  bookingController.finalizeBooking,
);
router.post("/cancel", verifyToken, bookingController.cancelBooking);
router.delete("/:bookingId", verifyToken, bookingController.deleteBooking);
router.post("/send-receipt/:bookingId", verifyToken, async (req, res) => {
  const { bookingId } = req.params;
  try {
    const booking = await Booking.findOne({
      _id: bookingId,
      user_id: req.userObjectId,
    })
      .populate("outlet_id", "shortform")
      .populate("service_id", "name price")
      .populate("staff_id", "fullname")
      .lean();

    const user = await User.findById(req.userObjectId).select("email").lean();

    if (!booking || !user?.email) {
      return res.status(404).json({ message: "Booking or user not found" });
    }

    const price =
      booking.price != null && !Number.isNaN(Number(booking.price))
        ? Number(booking.price)
        : Number(booking.service_id?.price) || 0;

    await sendBookingReceipt(
      {
        id: booking._id.toString(),
        outlet: booking.outlet_id?.shortform,
        service: booking.service_id?.name,
        date: booking.date,
        time: booking.time,
        customer_name: booking.customer_name,
        staff_name: booking.staff_id?.fullname,
        price,
        currency: "MYR",
        payment_method: "Online Payment",
        payment_status: "Paid",
      },
      user.email,
    );
    res.json({ message: "Receipt sent" });
  } catch (err) {
    console.error("Error sending receipt:", err.message);
    res.status(500).json({ message: "Server error" });
  }
});
router.post(
  "/set-pay-at-outlet",
  verifyToken,
  bookingController.setPayAtOutlet,
);

// New route for setting multiple bookings to pay at outlet
router.post(
  "/set-multiple-pay-at-outlet",
  verifyToken,
  bookingController.setMultiplePayAtOutlet,
);

router.get("/staff/sales", verifyToken, bookingController.getStaffSales);
router.get("/staff/payments", verifyToken, bookingController.getStaffPayments);
router.get("/manager/sales", verifyToken, bookingController.getManagerSales);
router.get(
  "/manager/payments",
  verifyToken,
  bookingController.getManagerPayments,
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
  paymentController.createSession,
);
router.post(
  "/payments/update-status",
  verifyToken,
  paymentController.updateStatus,
);
router.get(
  "/payments/status/:sessionId",
  verifyToken,
  paymentController.checkStatus,
);

router.get("/staff/schedule", verifyToken, bookingController.getStaffSchedule);
router.get(
  "/staff/appointments",
  verifyToken,
  bookingController.getStaffAppointments,
);
router.put(
  "/staff/appointment/:id/status",
  verifyToken,
  bookingController.updateAppointmentStatus,
);
router.put(
  "/staff/appointment/:id/reschedule",
  verifyToken,
  bookingController.rescheduleStaffAppointment,
);
router.delete(
  "/staff/appointment/:id",
  verifyToken,
  bookingController.cancelStaffAppointment,
);
router.post(
  "/staff/appointment",
  verifyToken,
  bookingController.createStaffAppointment,
);
router.post("/staff/mark-done", verifyToken, bookingController.markBookingDone);
router.post(
  "/staff/mark-absent",
  verifyToken,
  bookingController.markBookingAbsent,
);
router.get(
  "/booking-details/:id",
  verifyToken,
  bookingController.getBookingDetails,
);

// New route for total appointments yesterday
router.get(
  "/appointments/total-yesterday",
  verifyToken,
  bookingController.getTotalAppointmentsYesterday,
);

// Add to bookingRoutes.js
router.get(
  "/appointments/all",
  verifyToken,
  bookingController.getAllAppointments,
);
router.get(
  "/appointments/total-today",
  verifyToken,
  bookingController.getTotalAppointmentsToday,
);

router.get("/staff/bookings", verifyToken, bookingController.getStaffBookings);

// Additional route without /api prefix for compatibility
router.get("/staff/bookings", verifyToken, bookingController.getStaffBookings);

// Route to get bookings by phone number (for returning customers)
router.get(
  "/by-phone/:phoneNumber",
  verifyToken,
  bookingController.getBookingsByPhone,
);

// New route to claim a guest booking
router.patch(
  "/:booking_id/claim",
  verifyToken,
  bookingController.claimGuestBooking,
);

// Route to get appointments by user ID
router.get(
  "/staff/appointments/by-user/:userId",
  verifyToken,
  bookingController.getAppointmentsByUserId,
);

// Summary statistics for dashboard
router.get("/summary", verifyToken, bookingController.getStaffSummary);

// Today's appointments by staff for bar chart
router.get(
  "/todays-appointments-by-staff",
  verifyToken,
  bookingController.getTodaysAppointmentsByStaff,
);

// Sales report for today's completed bookings (for pie chart)
router.get("/sales-report", verifyToken, bookingController.getSalesReport);

// Daily transactions by outlet for transaction chart
router.get(
  "/daily-transactions",
  verifyToken,
  bookingController.getTodayTransactionsByOutlet,
);

// Customer satisfaction ratings for manager dashboard
router.get(
  "/customer-satisfaction",
  verifyToken,
  bookingController.getCustomerSatisfactionRatings,
);

// Manager reschedule and cancel appointment routes
router.put(
  "/manager/appointment/:id/reschedule",
  verifyToken,
  bookingController.managerRescheduleAppointment,
);
router.put(
  "/manager/appointment/:id/cancel",
  verifyToken,
  bookingController.managerCancelAppointment,
);

module.exports = router;
