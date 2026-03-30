const cron = require("node-cron");
const Booking = require("../models/Booking");
const { sendAppointmentReminder } = require("./smsService");

const startCronJobs = () => {
  cron.schedule("0 * * * *", async () => {
    try {
      const now = new Date();
      const bookings = await Booking.find({ status: "Pending" })
        .populate("user_id", "phone_number fullname")
        .populate("service_id", "name")
        .populate("outlet_id", "shortform")
        .populate("staff_id", "fullname")
        .lean();

      for (const booking of bookings) {
        const phone = booking.user_id?.phone_number;
        if (!phone) continue;

        const bookingDateTime = new Date(`${booking.date}T${booking.time}`);
        const hoursDiff = (bookingDateTime - now) / (1000 * 60 * 60);

        const bookingDetails = {
          id: booking._id.toString(),
          outlet: booking.outlet_id?.shortform,
          service: booking.service_id?.name,
          date: booking.date,
          time: booking.time,
          staff_name: booking.staff_id?.fullname,
        };

        try {
          if (hoursDiff >= 24 && hoursDiff < 25) {
            await sendAppointmentReminder(bookingDetails, phone, "24h");
          } else if (hoursDiff >= 1 && hoursDiff < 2) {
            await sendAppointmentReminder(bookingDetails, phone, "1h");
          }
        } catch (smsError) {
          console.error(`SMS failed for booking ${booking._id}:`, smsError.message);
        }
      }
    } catch (err) {
      console.error("Cron job error:", err.message);
    }
  });
};

module.exports = { startCronJobs };
