const Booking = require("../models/Booking");
const User = require("../models/User");
const { sendBookingReceipt } = require("./email");

async function sendPaidBookingReceipt(bookingId) {
  const booking = await Booking.findById(bookingId)
    .populate("outlet_id", "shortform")
    .populate("service_id", "name price")
    .populate("staff_id", "fullname")
    .lean();

  if (!booking) {
    throw new Error("Booking not found for receipt");
  }

  const user = await User.findById(booking.user_id).select("email").lean();
  if (!user?.email) {
    return { sent: false, reason: "no_email" };
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
    user.email
  );
  return { sent: true };
}

module.exports = { sendPaidBookingReceipt };
