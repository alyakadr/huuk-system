const express = require("express");
const router = express.Router();
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const pool = require("../config/db");
const { sendBookingReceipt } = require("../utils/email");

console.log("Webhook route initialized:", {
  timestamp: new Date().toISOString(),
});

router.post("/", async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    // Handle Stripe webhooks
    if (req.headers["stripe-signature"]) {
      const sig = req.headers["stripe-signature"];
      const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

      // Log raw request for debugging
      console.log("Stripe webhook request received:", {
        headers: req.headers,
        body: req.body ? JSON.stringify(req.body, null, 2) : "No body",
        timestamp: new Date().toISOString(),
      });

      let event;
      try {
        event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
        console.log("Stripe webhook event constructed:", {
          type: event.type,
          id: event.data.object.id,
          metadata: event.data.object.metadata,
          timestamp: new Date().toISOString(),
        });
      } catch (err) {
        console.error("Stripe webhook signature verification failed:", {
          message: err.message,
          stack: err.stack,
          timestamp: new Date().toISOString(),
        });
        await connection.rollback();
        return res.status(400).json({
          message: "Stripe webhook signature verification failed",
          error: err.message,
        });
      }

      if (event.type === "payment_intent.succeeded") {
        const paymentIntent = event.data.object;
        const bookingIdStr = paymentIntent.metadata?.booking_id;
        const userId = paymentIntent.metadata?.user_id;

        if (!bookingIdStr || !userId) {
          console.error("Missing booking_id or user_id in Stripe metadata:", {
            paymentIntentId: paymentIntent.id,
            metadata: event.data.object.metadata,
            timestamp: new Date().toISOString(),
          });
          await connection.rollback();
          return res
            .status(400)
            .json({ message: "Missing booking_id or user_id in metadata" });
        }

        const bookingId = parseInt(bookingIdStr, 10);
        if (isNaN(bookingId)) {
          console.error("Invalid booking_id in metadata:", {
            bookingIdStr,
            paymentIntentId: paymentIntent.id,
            timestamp: new Date().toISOString(),
          });
          await connection.rollback();
          return res.status(400).json({ message: "Invalid booking_id" });
        }

        // Verify booking exists
        const [booking] = await connection.query(
          "SELECT id, user_id, payment_status, payment_intent_id, status FROM bookings WHERE id = ? AND user_id = ?",
          [bookingId, userId]
        );
        console.log("Stripe booking query result:", {
          bookingId,
          userId,
          result: booking,
          timestamp: new Date().toISOString(),
        });

        if (!booking.length) {
          console.error("Booking not found for ID:", {
            bookingId,
            userId,
            timestamp: new Date().toISOString(),
          });
          await connection.rollback();
          return res.status(404).json({ message: "Booking not found" });
        }

        if (booking[0].payment_status === "Paid") {
          console.warn("Booking already paid:", {
            bookingId,
            paymentIntentId: paymentIntent.id,
            timestamp: new Date().toISOString(),
          });
          await connection.commit();
          return res.json({ received: true });
        }

        // Debug before update
        console.log("Before updating booking:", {
          bookingId,
          userId,
          paymentIntentId: paymentIntent.id,
          currentPaymentStatus: booking[0].payment_status,
          currentStatus: booking[0].status,
          timestamp: new Date().toISOString(),
        });

        // Find all related bookings for the same user, date, and customer_name with pending payment
        const [relatedBookings] = await connection.query(
          "SELECT id FROM bookings WHERE user_id = ? AND date = ? AND customer_name = ? AND payment_status = 'Pending'",
          [userId, booking[0].date, booking[0].customer_name]
        );
        console.log("Related bookings found for split booking update:", {
          bookingId,
          userId,
          date: booking[0].date,
          customerName: booking[0].customer_name,
          relatedBookingIds: relatedBookings.map(b => b.id),
          timestamp: new Date().toISOString(),
        });

        // Update all related bookings
        const relatedBookingIds = relatedBookings.map(b => b.id);
        if (relatedBookingIds.length > 0) {
          const placeholders = relatedBookingIds.map(() => '?').join(',');
          const [updateResult] = await connection.query(
            `UPDATE bookings SET payment_status = ?, status = ?, payment_method = ? WHERE id IN (${placeholders})`,
            ["Paid", "Confirmed", "Stripe", ...relatedBookingIds]
          );
          console.log("Stripe update result for all related bookings:", {
            bookingId,
            userId,
            relatedBookingIds,
            affectedRows: updateResult.affectedRows,
            paymentMethod: "Stripe",
            timestamp: new Date().toISOString(),
          });

          if (updateResult.affectedRows === 0) {
            console.error("Failed to update related bookings:", {
              bookingId,
              userId,
              relatedBookingIds,
              timestamp: new Date().toISOString(),
            });
            throw new Error("Failed to update payment status in database");
          }

          console.log(
            "Updated payment_status to Paid and status to Confirmed for all related bookings:",
            {
              bookingId,
              userId,
              relatedBookingIds,
              affectedRows: updateResult.affectedRows,
              paymentMethod: "Stripe",
              timestamp: new Date().toISOString(),
            }
          );
        } else {
          // Fallback: update only the original booking if no related bookings found
          const [updateResult] = await connection.query(
            "UPDATE bookings SET payment_status = ?, status = ?, payment_intent_id = ?, payment_method = ? WHERE id = ? AND user_id = ?",
            ["Paid", "Confirmed", paymentIntent.id, "Stripe", bookingId, userId]
          );
          console.log("Stripe fallback update result:", {
            bookingId,
            userId,
            affectedRows: updateResult.affectedRows,
            paymentIntentId: paymentIntent.id,
            paymentMethod: "Stripe",
            timestamp: new Date().toISOString(),
          });

          if (updateResult.affectedRows === 0) {
            console.error("Failed to update booking:", {
              bookingId,
              userId,
              paymentIntentId: paymentIntent.id,
              timestamp: new Date().toISOString(),
            });
            throw new Error("Failed to update payment status in database");
          }
        }

        // Emit WebSocket event
        try {
          const io = req.app.get("socketio");
          io.emit("booking_updated", {
            bookingId,
            userId,
            payment_status: "Paid",
            status: "Confirmed",
          });
          console.log("WebSocket event emitted for booking ID:", {
            bookingId,
            userId,
            event: "booking_updated",
            timestamp: new Date().toISOString(),
          });
        } catch (socketErr) {
          console.error("Failed to emit WebSocket event:", {
            message: socketErr.message,
            stack: socketErr.stack,
            bookingId,
            timestamp: new Date().toISOString(),
          });
        }

        // Commit transaction before sending email
        await connection.commit();

        // Send email receipt
        try {
          const [bookingDetails] = await connection.query(
            `SELECT b.id, o.shortform AS outlet, s.name AS service, s.price, b.date, b.time, b.customer_name, u.fullname AS staff_name
             FROM bookings b
             JOIN outlets o ON b.outlet_id = o.id
             JOIN services s ON b.service_id = s.id
             JOIN users u ON b.staff_id = u.id
             WHERE b.id = ? AND b.user_id = ?`,
            [bookingId, userId]
          );
          console.log("Booking details for email:", {
            bookingId,
            userId,
            details: bookingDetails,
            timestamp: new Date().toISOString(),
          });

          if (!bookingDetails.length) {
            console.error("Failed to fetch booking details for ID:", {
              bookingId,
              timestamp: new Date().toISOString(),
            });
            throw new Error("Failed to fetch booking details");
          }

          const [user] = await connection.query(
            "SELECT email FROM users WHERE id = ?",
            [booking[0].user_id]
          );
          console.log("User email query result:", {
            userId: booking[0].user_id,
            email: user.length ? user[0].email : null,
            timestamp: new Date().toISOString(),
          });

          if (user.length && user[0].email) {
            const emailDetails = {
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
            };

            await sendBookingReceipt(emailDetails, user[0].email);
            console.log("Email receipt sent for booking ID:", {
              bookingId,
              email: user[0].email,
              timestamp: new Date().toISOString(),
            });
          } else {
            console.warn("No email found for user ID:", {
              userId: booking[0].user_id,
              timestamp: new Date().toISOString(),
            });
          }
        } catch (emailErr) {
          console.error("Error sending email receipt:", {
            message: emailErr.message,
            stack: emailErr.stack,
            bookingId,
            timestamp: new Date().toISOString(),
          });
        }

        return res.json({ received: true });
      } else if (event.type === "payment_intent.payment_failed") {
        const paymentIntent = event.data.object;
        const bookingIdStr = paymentIntent.metadata?.booking_id;
        const userId = paymentIntent.metadata?.user_id;

        if (bookingIdStr && userId) {
          const bookingId = parseInt(bookingIdStr, 10);
          if (!isNaN(bookingId)) {
            await connection.query(
              "UPDATE bookings SET payment_status = 'Failed' WHERE id = ? AND user_id = ? AND payment_intent_id = ?",
              [bookingId, userId, paymentIntent.id]
            );
            console.log("Payment failed for booking ID:", {
              bookingId,
              userId,
              paymentIntentId: paymentIntent.id,
              timestamp: new Date().toISOString(),
            });
          }
        }

        await connection.commit();
        return res.json({ received: true });
      } else {
        console.log("Unhandled Stripe event type:", {
          type: event.type,
          timestamp: new Date().toISOString(),
        });
        await connection.commit();
        return res.json({ received: true });
      }
    } else {
      console.log("Non-Stripe webhook ignored:", {
        headers: req.headers,
        body: JSON.stringify(req.body, null, 2),
        timestamp: new Date().toISOString(),
      });
      await connection.commit();
      return res.json({ status: "received" });
    }
  } catch (err) {
    console.error("Webhook error:", {
      message: err.message,
      stack: err.stack,
      timestamp: new Date().toISOString(),
    });
    if (connection) await connection.rollback();
    return res
      .status(500)
      .json({ message: "Server error", error: err.message });
  } finally {
    if (connection) {
      console.log("Releasing database connection");
      connection.release();
    }
  }
});

module.exports = router;
