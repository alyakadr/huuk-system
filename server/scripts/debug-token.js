require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const jwt = require('jsonwebtoken');
const mysql = require('mysql2/promise');

// Database configuration
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'huuk'
};

async function debugTokenAndBooking() {
  let connection;
  
  try {
    // Connect to database
    connection = await mysql.createConnection(dbConfig);
    console.log('✓ Connected to MySQL database');

    // Check booking 108 details
    const [bookingRows] = await connection.execute(
      'SELECT id, staff_id, customer_name, date, time, status FROM bookings WHERE id = ?',
      [108]
    );

    if (bookingRows.length === 0) {
      console.log('❌ Booking 108 not found');
      return;
    }

    const booking = bookingRows[0];
    console.log('\n📋 Booking Details:');
    console.log(`ID: ${booking.id}`);
    console.log(`Staff ID: ${booking.staff_id} (type: ${typeof booking.staff_id})`);
    console.log(`Customer: ${booking.customer_name}`);
    console.log(`Date: ${booking.appointment_date}`);
    console.log(`Time: ${booking.appointment_time}`);
    console.log(`Status: ${booking.status}`);

    // Check staff details
    const [staffRows] = await connection.execute(
      'SELECT id, name, email, role FROM staff WHERE id = ?',
      [booking.staff_id]
    );

    if (staffRows.length === 0) {
      console.log('❌ Staff not found for booking');
      return;
    }

    const staff = staffRows[0];
    console.log('\n👤 Staff Details:');
    console.log(`ID: ${staff.id} (type: ${typeof staff.id})`);
    console.log(`Name: ${staff.name}`);
    console.log(`Email: ${staff.email}`);
    console.log(`Role: ${staff.role}`);

    // Create a sample JWT token for this user
    const payload = {
      userId: staff.id,
      role: staff.role
    };

    const secret = process.env.JWT_SECRET || 'your-secret-key'; // You might need to check your actual secret
    const token = jwt.sign(payload, secret, { expiresIn: '24h' });
    
    console.log('\n🔐 Generated JWT Token:');
    console.log(token);

    // Verify the token
    const decoded = jwt.verify(token, secret);
    console.log('\n✅ Decoded Token:');
    console.log(`User ID: ${decoded.userId} (type: ${typeof decoded.userId})`);
    console.log(`Role: ${decoded.role}`);

    // Check if authorization would work
    console.log('\n🔍 Authorization Check:');
    console.log(`Booking staff_id: ${booking.staff_id} (${typeof booking.staff_id})`);
    console.log(`Token userId: ${decoded.userId} (${typeof decoded.userId})`);
    console.log(`Match: ${booking.staff_id == decoded.userId}`);
    console.log(`Strict match: ${booking.staff_id === decoded.userId}`);
    console.log(`Role authorized: ${decoded.role === 'staff' || decoded.role === 'manager'}`);

    // Test the authorization logic
    const isAuthorized = (booking.staff_id == decoded.userId) && (decoded.role === 'staff' || decoded.role === 'manager');
    console.log(`\n${isAuthorized ? '✅' : '❌'} Authorization result: ${isAuthorized}`);

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// Run the debug
debugTokenAndBooking();
