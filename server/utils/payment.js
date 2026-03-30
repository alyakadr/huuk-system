const mongoose = require("mongoose");
const Booking = require("../models/Booking");
const { getStripeClient } = require("./stripeClient");

function linePrice(bookingDoc) {
  const fromBooking = bookingDoc.price;
  if (fromBooking != null && !Number.isNaN(Number(fromBooking))) {
    return Number(fromBooking);
  }
  const svc = bookingDoc.service_id;
  if (svc && svc.price != null) {
    return Number(svc.price);
  }
  return NaN;
}

const createSession = async (req, res) => {
  const { booking_id, booking_ids, total_amount } = req.body;
  const isMultipleBookings =
    booking_ids && Array.isArray(booking_ids) && booking_ids.length > 0;
  const rawBookingIds = isMultipleBookings ? booking_ids : [booking_id];
  const bookingIds = [
    ...new Set(rawBookingIds.map((id) => String(id || "").trim())),
  ];

  if (!bookingIds.length || bookingIds.some((id) => !id)) {
    return res.status(400).json({ message: "Valid booking ID(s) required" });
  }

  const invalidIds = bookingIds.filter(
    (id) => !mongoose.Types.ObjectId.isValid(id),
  );
  if (invalidIds.length > 0) {
    return res.status(400).json({
      message: "Invalid booking ID format",
      detail: `Invalid booking ID(s): ${invalidIds.join(", ")}`,
    });
  }

  try {
    const { stripe, configError } = getStripeClient();
    if (!stripe) {
      return res.status(500).json({
        message: "Payment provider configuration error",
        detail: configError,
      });
    }

    const isStaff = ["staff", "manager", "admin"].includes(req.role);
    const ownerFilter = isStaff ? {} : { user_id: req.userObjectId };
    const bookings = await Booking.find({
      _id: { $in: bookingIds },
      ...ownerFilter,
    })
      .populate("service_id", "name price")
      .populate("outlet_id", "name")
      .lean();

    if (bookings.length !== bookingIds.length) {
      const foundIds = new Set(bookings.map((b) => String(b._id)));
      const missingIds = bookingIds.filter((id) => !foundIds.has(String(id)));
      return res.status(404).json({
        message: "One or more bookings not found",
        detail: missingIds.length
          ? `Missing booking ID(s): ${missingIds.join(", ")}`
          : undefined,
      });
    }

    const paidBooking = bookings.find((b) => b.payment_status === "Paid");
    if (paidBooking) {
      return res
        .status(400)
        .json({ message: `Booking ${paidBooking._id} already paid` });
    }

    const invalidPriceBooking = bookings.find((b) => {
      const p = linePrice(b);
      return Number.isNaN(p) || p <= 0;
    });
    if (invalidPriceBooking) {
      return res.status(400).json({
        message: "Invalid booking price",
        detail: `Booking ${invalidPriceBooking._id} has an invalid price`,
      });
    }

    const calculatedTotal = bookings.reduce((sum, b) => sum + linePrice(b), 0);

    let finalAmount;
    if (isMultipleBookings) {
      if (
        total_amount == null ||
        Number.isNaN(Number(total_amount)) ||
        Number(total_amount) <= 0
      ) {
        return res.status(400).json({ message: "Invalid total amount" });
      }
      const providedTotal = Number(total_amount);
      if (Math.abs(providedTotal - calculatedTotal) > 0.01) {
        return res.status(400).json({
          message: "Total amount does not match sum of booking prices",
        });
      }
      finalAmount = providedTotal;
    } else {
      finalAmount = calculatedTotal;
    }

    const first = bookings[0];
    const serviceName = first.service_id?.name || "Service";
    const outletName = first.outlet_id?.name || "Outlet";
    const description = isMultipleBookings
      ? `Payment for ${bookings.length} bookings (IDs: ${bookingIds.join(", ")})`
      : `Payment for booking #${first._id} - ${serviceName} at ${outletName}`;

    const metadata = {
      booking_ids: bookingIds.join(","),
      user_id: req.userId,
      is_multiple: isMultipleBookings ? "true" : "false",
    };

    const paymentIntent = await stripe.paymentIntents.create(
      {
        amount: Math.round(finalAmount * 100),
        currency: "myr",
        payment_method_types: ["card", "fpx"],
        metadata,
        description,
        confirm: false,
      },
      { idempotencyKey: [...bookingIds].sort().join("-") },
    );

    await Booking.updateMany(
      { _id: { $in: bookingIds } },
      {
        $set: { payment_intent_id: paymentIntent.id, payment_method: "Stripe" },
      },
    );

    res.json({
      clientSecret: paymentIntent.client_secret,
      price: finalAmount,
    });
  } catch (err) {
    console.error("Error creating payment session:", err.message);
    const stripeDetail = err?.raw?.message || err?.message || "Unknown error";
    res.status(500).json({ message: "Server error", detail: stripeDetail });
  }
};

const updateStatus = async (req, res) => {
  const { booking_id, status } = req.body;
  if (!booking_id || !status) {
    return res.status(400).json({ message: "Booking ID and status required" });
  }
  try {
    const booking = await Booking.findById(booking_id).select(
      "user_id payment_status",
    );
    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }
    if (String(booking.user_id) !== req.userId) {
      return res.status(403).json({ message: "Not authorized" });
    }
    if (booking.payment_status === "Paid" && status === "Paid") {
      return res.status(400).json({ message: "Booking already paid" });
    }
    await Booking.findByIdAndUpdate(booking_id, { payment_status: status });
    res.json({ message: "Payment status updated" });
  } catch (err) {
    console.error("Error updating payment status:", err.message);
    res.status(500).json({ message: "Server error", detail: err.message });
  }
};

const checkStatus = async (req, res) => {
  const { sessionId } = req.params;
  if (!sessionId) {
    return res.status(400).json({ message: "Session ID required" });
  }
  try {
    const booking = await Booking.findOne({
      payment_intent_id: sessionId,
      user_id: req.userObjectId,
    })
      .populate("service_id", "name price duration")
      .populate("outlet_id", "shortform name")
      .populate("staff_id", "fullname")
      .lean();

    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }

    const paymentMethod =
      booking.payment_method === "Stripe"
        ? "Online Payment"
        : booking.payment_method;

    res.json({
      booking_id: booking._id.toString(),
      payment_status: booking.payment_status,
      outlet_shortform: booking.outlet_id?.shortform || booking.outlet_id?.name,
      service_name: booking.service_id?.name,
      service_duration: booking.service_id?.duration || 30,
      serviceDuration: booking.service_id?.duration || 30,
      date: booking.date,
      time: booking.time,
      customer_name: booking.customer_name,
      staff_name: booking.staff_id?.fullname,
      price: linePrice(booking) || 0,
      payment_method: paymentMethod,
    });
  } catch (err) {
    console.error("Error checking payment status:", err.message);
    res.status(500).json({ message: "Server error", detail: err.message });
  }
};

module.exports = { createSession, updateStatus, checkStatus };
