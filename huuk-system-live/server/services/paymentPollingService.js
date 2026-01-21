const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const pool = require('../config/db');
const { sendBookingReceipt } = require('../utils/email');

class PaymentPollingService {
  constructor() {
    this.isPolling = false;
    this.pollInterval = 30000; // 30 seconds
    this.timeoutHandle = null;
  }

  async checkPendingPayments() {
    if (this.isPolling) return;
    
    this.isPolling = true;
    let connection;
    
    try {
      connection = await pool.getConnection();
      
      // Get all bookings with pending online payments from the last 24 hours
      const [pendingBookings] = await connection.query(`
        SELECT id, user_id, payment_intent_id, customer_name, date, time
        FROM bookings 
        WHERE payment_method = 'Stripe' 
        AND payment_status = 'Pending' 
        AND payment_intent_id IS NOT NULL
        AND created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
      `);

      console.log(`🔍 Checking ${pendingBookings.length} pending Stripe payments...`);

      for (const booking of pendingBookings) {
        try {
          // Check payment status with Stripe
          const paymentIntent = await stripe.paymentIntents.retrieve(booking.payment_intent_id);
          
          if (paymentIntent.status === 'succeeded') {
            await this.updateBookingAsPaid(connection, booking, paymentIntent.id);
            console.log(`✅ Updated booking ${booking.id} as paid`);
          } else if (paymentIntent.status === 'payment_failed' || paymentIntent.status === 'canceled') {
            await this.updateBookingAsFailed(connection, booking);
            console.log(`❌ Updated booking ${booking.id} as failed`);
          }
          
          // Small delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 100));
          
        } catch (stripeError) {
          console.error(`Error checking payment for booking ${booking.id}:`, stripeError.message);
        }
      }
      
    } catch (error) {
      console.error('Error in payment polling:', error);
    } finally {
      if (connection) connection.release();
      this.isPolling = false;
    }
  }

  async updateBookingAsPaid(connection, booking, paymentIntentId) {
    await connection.beginTransaction();
    
    try {
      // First, get the booking details to find related bookings
      const [bookingDetails] = await connection.query(
        'SELECT user_id, date, customer_name FROM bookings WHERE id = ?',
        [booking.id]
      );
      
      if (bookingDetails.length === 0) {
        console.error(`Booking ${booking.id} not found for payment update`);
        return;
      }
      
      const { user_id, date, customer_name } = bookingDetails[0];
      
      // Find all related bookings for the same customer on the same date with pending payment
      const [relatedBookings] = await connection.query(
        'SELECT id FROM bookings WHERE user_id = ? AND date = ? AND customer_name = ? AND payment_status = "Pending"',
        [user_id, date, customer_name]
      );
      
      if (relatedBookings.length > 0) {
        const bookingIds = relatedBookings.map(b => b.id);
        console.log(`📋 Updating payment status for ${bookingIds.length} related bookings: ${bookingIds.join(', ')}`);
        
        // Update all related bookings to paid status
        const placeholders = bookingIds.map(() => '?').join(',');
        const [updateResult] = await connection.query(
          `UPDATE bookings SET payment_status = 'Paid', status = 'Confirmed' WHERE id IN (${placeholders})`,
          bookingIds
        );
        
        console.log(`✅ Successfully updated ${updateResult.affectedRows} related bookings to Paid status`);
      } else {
        // Fallback: Update just the single booking
        await connection.query(
          'UPDATE bookings SET payment_status = ?, status = ? WHERE id = ?',
          ['Paid', 'Confirmed', booking.id]
        );
      }

      // Emit WebSocket event if available
      try {
        const io = global.socketio;
        if (io) {
          io.emit('booking_updated', {
            bookingId: booking.id,
            userId: booking.user_id,
            payment_status: 'Paid',
            status: 'Confirmed'
          });
        }
      } catch (socketError) {
        console.error('WebSocket emit error:', socketError.message);
      }

      // Send email receipt
      await this.sendEmailReceipt(connection, booking);
      
      await connection.commit();
      
    } catch (error) {
      await connection.rollback();
      throw error;
    }
  }

  async updateBookingAsFailed(connection, booking) {
    await connection.query(
      'UPDATE bookings SET payment_status = ? WHERE id = ?',
      ['Failed', booking.id]
    );
  }

  async sendEmailReceipt(connection, booking) {
    try {
      const [bookingDetails] = await connection.query(`
        SELECT b.id, o.shortform AS outlet, s.name AS service, s.price, 
               b.date, b.time, b.customer_name, u.fullname AS staff_name
        FROM bookings b
        JOIN outlets o ON b.outlet_id = o.id
        JOIN services s ON b.service_id = s.id
        JOIN users u ON b.staff_id = u.id
        WHERE b.id = ?
      `, [booking.id]);

      const [user] = await connection.query(
        'SELECT email FROM users WHERE id = ?',
        [booking.user_id]
      );

      if (bookingDetails.length && user.length && user[0].email) {
        const emailDetails = {
          id: bookingDetails[0].id,
          outlet: bookingDetails[0].outlet,
          service: bookingDetails[0].service,
          date: bookingDetails[0].date,
          time: bookingDetails[0].time,
          customer_name: bookingDetails[0].customer_name,
          staff_name: bookingDetails[0].staff_name,
          price: parseFloat(bookingDetails[0].price),
          currency: 'MYR',
          payment_method: 'Online Payment',
          payment_status: 'Paid'
        };

        await sendBookingReceipt(emailDetails, user[0].email);
        console.log(`📧 Email receipt sent for booking ${booking.id}`);
      }
    } catch (emailError) {
      console.error('Error sending email receipt:', emailError.message);
    }
  }

  start() {
    if (this.timeoutHandle) return;
    
    console.log('🚀 Starting payment polling service...');
    
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
      console.log('🛑 Payment polling service stopped');
    }
  }
}

module.exports = new PaymentPollingService();
