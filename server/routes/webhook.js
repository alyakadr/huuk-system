const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();
const Booking = require("../models/Booking");
const {
  confirmPaidFromStripe,
} = require("../services/stripeBookingConfirmation");
const { sendPaidBookingReceipt } = require("../utils/bookingReceiptEmail");
const { getStripeClient } = require("../utils/stripeClient");
const { emitToUser } = require("../utils/socketEmit");

function parseBookingIds(metadata) {
  if (!metadata) return [];
  if (metadata.booking_ids) {
    return metadata.booking_ids
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  if (metadata.booking_id) {
    return [String(metadata.booking_id).trim()].filter(Boolean);
  }
  return [];
}

router.post("/", async (req, res) => {
  try {
    const { stripe, configError } = getStripeClient();
    if (!stripe) {
      return res.status(500).json({
        message: "Payment provider configuration error",
      });
    }

    if (!req.headers["stripe-signature"]) {
      return res.json({ status: "received" });
    }

    const sig = req.headers["stripe-signature"];
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
    let event;
    try {
      event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
    } catch (err) {
      console.error(
        "Stripe webhook signature verification failed:",
        err.message,
      );
      return res.status(400).json({
        message: "Stripe webhook signature verification failed",
      });
    }

    if (event.type === "payment_intent.succeeded") {
      const paymentIntent = event.data.object;
      const bookingIds = parseBookingIds(paymentIntent.metadata);
      const userId = paymentIntent.metadata?.user_id;

      if (!bookingIds.length || !userId) {
        return res
          .status(400)
          .json({ message: "Missing booking id(s) or user_id in metadata" });
      }

      let result;
      try {
        result = await confirmPaidFromStripe(
          paymentIntent.id,
          userId,
          bookingIds,
        );
      } catch (e) {
        if (e.message === "Booking not found or user mismatch") {
          return res.status(404).json({ message: "Booking not found" });
        }
        throw e;
      }

      if (result.alreadyPaid) {
        return res.json({ received: true });
      }

      try {
        const io = req.app.get("socketio");
        if (io && result.updatedIds[0]) {
          emitToUser(io, userId, "booking_updated", {
            bookingId: result.updatedIds[0],
            userId,
            payment_status: "Paid",
            status: "Confirmed",
          });
        }
      } catch (socketErr) {
        console.error("WebSocket emit failed:", socketErr.message);
      }

      try {
        await sendPaidBookingReceipt(bookingIds[0]);
      } catch (emailErr) {
        console.error("Email receipt error:", emailErr.message);
      }

      return res.json({ received: true });
    }

    if (event.type === "payment_intent.payment_failed") {
      const paymentIntent = event.data.object;
      const userIdRaw = paymentIntent.metadata?.user_id;
      const userIdStr = userIdRaw != null ? String(userIdRaw).trim() : "";
      if (userIdStr && mongoose.Types.ObjectId.isValid(userIdStr)) {
        await Booking.updateMany(
          {
            payment_intent_id: paymentIntent.id,
            user_id: new mongoose.Types.ObjectId(userIdStr),
          },
          { $set: { payment_status: "Failed" } },
        );
      }
      return res.json({ received: true });
    }

    return res.json({ received: true });
  } catch (err) {
    console.error("Webhook error:", err.message);
    return res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
