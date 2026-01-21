const cron = require("node-cron");
const pool = require("../config/db");
const { sendAppointmentReminder } = require("./smsService");

const startCronJobs = () => {
  // Run every hour to send reminders
  cron.schedule("0 * * * *", async () => {
    let connection;
    try {
      connection = await pool.getConnection();
      const now = new Date();
      const [bookings] = await connection.query(
        `SELECT b.id, b.date, b.time, u.phone_number, s.name AS service_name, o.shortform AS outlet_shortform, u.fullname AS staff_name
         FROM bookings b
         JOIN users u ON b.user_id = u.id
         JOIN services s ON b.service_id = s.id
         JOIN outlets o ON b.outlet_id = o.id
         WHERE b.status = 'Pending'`
      );
      for (const booking of bookings) {
        const bookingDateTime = new Date(`${booking.date}T${booking.time}`);

        if (!booking.phone_number) continue;

        const hoursDiff = (bookingDateTime - now) / (1000 * 60 * 60);
        const bookingDetails = {
          id: booking.id,
          outlet: booking.outlet_shortform,
          service: booking.service_name,
          date: booking.date,
          time: booking.time,
          staff_name: booking.staff_name
        };

        try {
          if (hoursDiff >= 24 && hoursDiff < 25) {
            // Send 24-hour reminder
            await sendAppointmentReminder(bookingDetails, booking.phone_number, '24h');
            console.log(`Sent 24-hour reminder for booking ${booking.id}`);
          } else if (hoursDiff >= 1 && hoursDiff < 2) {
            // Send 1-hour reminder
            await sendAppointmentReminder(bookingDetails, booking.phone_number, '1h');
            console.log(`Sent 1-hour reminder for booking ${booking.id}`);
          }
        } catch (smsError) {
          console.error(`Failed to send SMS for booking ${booking.id}:`, smsError.message);
        }
      }
    } catch (err) {
      console.error("Cron job error:", err.message);
    } finally {
      if (connection) connection.release();
    }
  });
};

module.exports = { startCronJobs };
