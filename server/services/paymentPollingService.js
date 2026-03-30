const Booking = require("../models/Booking");
const { confirmPaidFromStripe } = require("./stripeBookingConfirmation");
const { sendPaidBookingReceipt } = require("../utils/bookingReceiptEmail");
const { getStripeClient } = require("../utils/stripeClient");

class PaymentPollingService {
  constructor() {
    this.isPolling = false;
    this.pollInterval = 30000;
    this.timeoutHandle = null;
  }

  async checkPendingPayments() {
    if (this.isPolling) return;

    this.isPolling = true;

    try {
      const { stripe, configError } = getStripeClient();
      if (!stripe) {
        console.warn("Payment polling skipped:", configError);
        return;
      }

      const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const pendingBookings = await Booking.find({
        payment_method: "Stripe",
        payment_status: "Pending",
        payment_intent_id: { $ne: null, $exists: true },
        createdAt: { $gte: since },
      })
        .select("_id user_id payment_intent_id")
        .lean();

      for (const booking of pendingBookings) {
        try {
          const paymentIntent = await stripe.paymentIntents.retrieve(
            booking.payment_intent_id,
          );

          if (paymentIntent.status === "succeeded") {
            const result = await confirmPaidFromStripe(
              paymentIntent.id,
              booking.user_id.toString(),
              [booking._id.toString()],
            );
            if (!result.alreadyPaid) {
              try {
                const io = global.socketio;
                if (io && result.updatedIds[0]) {
                  io.emit("booking_updated", {
                    bookingId: result.updatedIds[0],
                    userId: booking.user_id.toString(),
                    payment_status: "Paid",
                    status: "Confirmed",
                  });
                }
              } catch (socketError) {
                console.error("WebSocket emit error:", socketError.message);
              }
              try {
                await sendPaidBookingReceipt(booking._id.toString());
              } catch (emailError) {
                console.error("Email receipt error:", emailError.message);
              }
            }
          } else if (
            paymentIntent.status === "payment_failed" ||
            paymentIntent.status === "canceled"
          ) {
            await Booking.findByIdAndUpdate(booking._id, {
              payment_status: "Failed",
            });
          }

          await new Promise((r) => setTimeout(r, 100));
        } catch (stripeError) {
          console.error(
            `Payment check failed for booking ${booking._id}:`,
            stripeError.message,
          );
        }
      }
    } catch (error) {
      console.error("Error in payment polling:", error.message);
    } finally {
      this.isPolling = false;
    }
  }

  start() {
    if (this.timeoutHandle) return;

    const { stripe, configError } = getStripeClient();
    if (!stripe) {
      console.warn("Payment polling not started:", configError);
      return;
    }

    const poll = async () => {
      await this.checkPendingPayments();
      this.timeoutHandle = setTimeout(poll, this.pollInterval);
    };

    poll();
  }

  stop() {
    if (this.timeoutHandle) {
      clearTimeout(this.timeoutHandle);
      this.timeoutHandle = null;
    }
  }
}

module.exports = new PaymentPollingService();
