const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const pool = require("../config/db");

const createSession = async (req, res) => {
  const { booking_id, booking_ids, total_amount } = req.body;
  console.log("Create payment session request:", {
    booking_id,
    booking_ids,
    total_amount,
    userId: req.userId,
  });
  
  // Handle both single and multiple booking payments
  const isMultipleBookings = booking_ids && Array.isArray(booking_ids) && booking_ids.length > 0;
  const bookingIds = isMultipleBookings ? booking_ids : [booking_id];
  
  if (!bookingIds || bookingIds.length === 0 || bookingIds.some(id => !id)) {
    console.error("Valid booking ID(s) required");
    return res.status(400).json({ message: "Valid booking ID(s) required" });
  }
  let connection;
  try {
    connection = await pool.getConnection();
    console.log(
      "Executing booking query for IDs:",
      bookingIds,
      "userId:",
      req.userId
    );
    
    // Create placeholders for the IN clause
    const placeholders = bookingIds.map(() => '?').join(',');
    
    const [bookings] = await connection.query(
      `SELECT b.*, s.price, s.name as service_name, o.name as outlet_name
       FROM bookings b
       JOIN services s ON b.service_id = s.id
       JOIN outlets o ON b.outlet_id = o.id
       WHERE b.id IN (${placeholders}) AND b.user_id = ?`,
      [...bookingIds, req.userId]
    );
    
    console.log("Booking query result:", bookings);
    
    if (!bookings || bookings.length !== bookingIds.length) {
      console.error(
        "Not all bookings found for IDs:",
        bookingIds,
        "found:",
        bookings?.length || 0,
        "userId:",
        req.userId
      );
      return res.status(404).json({ message: "One or more bookings not found" });
    }
    
    // Check if any booking is already paid
    const paidBooking = bookings.find(b => b.payment_status === "Paid");
    if (paidBooking) {
      console.warn("Booking already paid:", paidBooking.id);
      return res.status(400).json({ message: `Booking ${paidBooking.id} already paid` });
    }
    
    // Calculate total price and validate
    const calculatedTotal = bookings.reduce((sum, booking) => {
      const price = Number(booking.price);
      if (!price || isNaN(price) || price <= 0) {
        throw new Error(`Invalid price for booking ${booking.id}: ${booking.price}`);
      }
      return sum + price;
    }, 0);
    
    // For multiple bookings, validate the total amount
    let finalAmount;
    if (isMultipleBookings) {
      if (!total_amount || isNaN(total_amount) || total_amount <= 0) {
        console.error("Invalid total amount provided:", total_amount);
        return res.status(400).json({ message: "Invalid total amount" });
      }
      
      const providedTotal = Number(total_amount);
      if (Math.abs(providedTotal - calculatedTotal) > 0.01) {
        console.error(
          "Total amount mismatch. Provided:",
          providedTotal,
          "Calculated:",
          calculatedTotal
        );
        return res.status(400).json({ 
          message: "Total amount does not match sum of booking prices"
        });
      }
      finalAmount = providedTotal;
    } else {
      finalAmount = calculatedTotal;
    }
    
    console.log("Creating payment intent for amount:", finalAmount);
    
    // Create description based on bookings
    const description = isMultipleBookings 
      ? `Payment for ${bookings.length} bookings (IDs: ${bookingIds.join(', ')})`
      : `Payment for booking #${bookings[0].id} - ${bookings[0].service_name} at ${bookings[0].outlet_name}`;
    
    // Create metadata with all booking IDs
    const metadata = {
      booking_ids: bookingIds.join(','),
      user_id: req.userId,
      is_multiple: isMultipleBookings ? 'true' : 'false'
    };
    
    const paymentIntent = await stripe.paymentIntents.create(
      {
        amount: Math.round(finalAmount * 100),
        currency: "myr",
        payment_method_types: ["card", "fpx"],
        metadata: metadata,
        description: description,
        confirm: false,
      },
      {
        idempotencyKey: bookingIds.sort().join('-'), // Deterministic key for multiple bookings
      }
    );
    
    console.log(
      "Payment Intent created:",
      paymentIntent.id,
      "with metadata:",
      paymentIntent.metadata
    );
    
    // Update all bookings with the payment intent ID
    const updatePromises = bookingIds.map(id => 
      connection.query(
        "UPDATE bookings SET payment_intent_id = ?, payment_method = ? WHERE id = ?",
        [paymentIntent.id, "Stripe", id]
      )
    );
    
    await Promise.all(updatePromises);
    
    console.log(
      "All bookings updated with payment_intent_id:",
      paymentIntent.id,
      "and payment_method: Stripe"
    );
    
    res.json({
      clientSecret: paymentIntent.client_secret,
      price: finalAmount,
    });
  } catch (err) {
    console.error("Error creating payment session:", err.message, err.stack);
    res.status(500).json({ message: "Server error", error: err.message });
  } finally {
    if (connection) {
      console.log("Releasing database connection");
      connection.release();
    }
  }
};

const updateStatus = async (req, res) => {
  const { booking_id, status } = req.body;
  if (!booking_id || !status) {
    console.error("Booking ID and status required");
    return res.status(400).json({ message: "Booking ID and status required" });
  }
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();
    const [booking] = await connection.query(
      "SELECT user_id, payment_status FROM bookings WHERE id = ?",
      [booking_id]
    );
    if (!booking.length) {
      console.error("Booking not found:", booking_id);
      return res.status(404).json({ message: "Booking not found" });
    }
    if (String(booking[0].user_id) !== req.userId) {
      console.error("Unauthorized access to booking:", booking_id);
      return res.status(403).json({ message: "Not authorized" });
    }
    if (booking[0].payment_status === "Paid" && status === "Paid") {
      console.warn("Booking already paid:", booking_id);
      return res.status(400).json({ message: "Booking already paid" });
    }
    await connection.query(
      "UPDATE bookings SET payment_status = ? WHERE id = ?",
      [status, booking_id]
    );
    await connection.commit();
    console.log(
      "Payment status updated for booking:",
      booking_id,
      "to:",
      status
    );
    res.json({ message: "Payment status updated" });
  } catch (err) {
    if (connection) await connection.rollback();
    console.error("Error updating payment status:", err.message, err.stack);
    res.status(500).json({ message: "Server error", error: err.message });
  } finally {
    if (connection) connection.release();
  }
};

const checkStatus = async (req, res) => {
  const { sessionId } = req.params;
  if (!sessionId) {
    console.error("Session ID required");
    return res.status(400).json({ message: "Session ID required" });
  }
  let connection;
  try {
    connection = await pool.getConnection();
    const [booking] = await connection.query(
      `SELECT b.id, b.payment_status, b.outlet_id, b.service_id, b.date, b.time, b.customer_name, b.payment_method, u.fullname as staff_name, s.name as service_name, o.shortform as outlet_shortform, s.price
       FROM bookings b
       JOIN services s ON b.service_id = s.id
       JOIN outlets o ON b.outlet_id = o.id
       JOIN users u ON b.staff_id = u.id
       WHERE b.payment_intent_id = ? AND b.user_id = ?`,
      [sessionId, req.userId]
    );
    if (!booking.length) {
      console.error("Booking not found for session ID:", sessionId);
      return res.status(404).json({ message: "Booking not found" });
    }
    const paymentMethod =
      booking[0].payment_method === "Stripe"
        ? "Online Payment"
        : booking[0].payment_method;
    console.log(
      "Payment status for session:",
      sessionId,
      "is:",
      booking[0].payment_status,
      "with payment_method:",
      paymentMethod
    );
    res.json({
      booking_id: booking[0].id,
      payment_status: booking[0].payment_status,
      outlet_shortform: booking[0].outlet_shortform,
      service_name: booking[0].service_name,
      date: booking[0].date,
      time: booking[0].time,
      customer_name: booking[0].customer_name,
      staff_name: booking[0].staff_name,
      price: Number(booking[0].price) || 0,
      payment_method: paymentMethod,
    });
  } catch (err) {
    console.error("Error checking payment status:", err.message, err.stack);
    res.status(500).json({ message: "Server error", error: err.message });
  } finally {
    if (connection) connection.release();
  }
};

module.exports = { createSession, updateStatus, checkStatus };
