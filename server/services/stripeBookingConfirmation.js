const mongoose = require("mongoose");
const Booking = require("../models/Booking");

function toObjectId(value, fieldName) {
  const s = value == null ? "" : String(value).trim();
  if (!mongoose.Types.ObjectId.isValid(s)) {
    throw new Error(`Invalid ${fieldName}`);
  }
  return new mongoose.Types.ObjectId(s);
}

/**
 * Marks the booking group (same user, date, customer_name) as paid after Stripe success.
 * @param {string} paymentIntentId
 * @param {string|mongoose.Types.ObjectId} userId
 * @param {Array<string|mongoose.Types.ObjectId>} seedBookingIds
 * @returns {{ alreadyPaid: boolean, updatedIds: string[] }}
 */
async function confirmPaidFromStripe(paymentIntentId, userId, seedBookingIds) {
  const userObjectId = toObjectId(userId, "user_id");
  const bookingObjectIds = seedBookingIds.map((id) => toObjectId(id, "booking_id"));

  const bookings = await Booking.find({
    _id: { $in: bookingObjectIds },
    user_id: userObjectId,
  }).lean();

  if (bookings.length !== seedBookingIds.length) {
    throw new Error("Booking not found or user mismatch");
  }

  const primary = bookings[0];
  if (primary.payment_status === "Paid") {
    return { alreadyPaid: true, updatedIds: [] };
  }

  const related = await Booking.find({
    user_id: userObjectId,
    date: primary.date,
    customer_name: primary.customer_name,
    payment_status: "Pending",
  }).select("_id");

  const ids = related.length > 0 ? related.map((b) => b._id) : [primary._id];

  await Booking.updateMany(
    { _id: { $in: ids } },
    {
      $set: {
        payment_status: "Paid",
        status: "Confirmed",
        payment_method: "Stripe",
        payment_intent_id: paymentIntentId,
        is_draft: false,
      },
    }
  );

  return { alreadyPaid: false, updatedIds: ids.map((id) => id.toString()) };
}

module.exports = { confirmPaidFromStripe };
