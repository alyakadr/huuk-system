const pool = require('../config/db');

(async () => {
  try {
    const connection = await pool.getConnection();
    
    // Check what the current date looks like in different formats
    const now = new Date();
    const currentDateGB = now.toLocaleDateString('en-GB');
    const currentDateISO = now.toISOString().slice(0, 10);
    const currentTime = now.toTimeString().slice(0, 5);
    
    console.log('Current date (GB format):', currentDateGB);
    console.log('Current date (ISO format):', currentDateISO);
    console.log('Current time:', currentTime);
    console.log('---');
    
    // Check what dates exist in the database
    const [dates] = await connection.query(`SELECT DISTINCT date, DATE_FORMAT(date, "%d/%m/%Y") as formatted_date FROM bookings ORDER BY date DESC LIMIT 10`);
    console.log('Dates in database:', dates);
    console.log('---');
    
    // Check bookings for staff ID 19 (the one we saw in logs)
    const [bookings] = await connection.query('SELECT id, staff_id, date, time, customer_name, status FROM bookings WHERE staff_id = 19 ORDER BY date DESC, time DESC LIMIT 10');
    console.log('Bookings for staff 19:', bookings);
    console.log('---');
    
    // Test the actual query being used in getStaffSchedule
    const [results] = await connection.query(
      `SELECT b.id, b.customer_name, u.phone_number, s.name AS service_name, 
              b.time AS start_time, 
              DATE_FORMAT(DATE_ADD(STR_TO_DATE(CONCAT(b.date, ' ', b.time), '%Y-%m-%d %H:%i'), 
                      INTERVAL s.duration MINUTE), '%H:%i') AS end_time, b.status
       FROM bookings b
       JOIN services s ON b.service_id = s.id
       LEFT JOIN users u ON b.user_id = u.id
       WHERE b.staff_id = ? AND DATE_FORMAT(b.date, '%d/%m/%Y') = ? AND b.status NOT IN ('Cancelled', 'Completed')
       ORDER BY b.time ASC
       LIMIT 3`,
      [19, currentDateGB]
    );
    console.log('Query results with current date:', results);
    console.log('---');
    
    // Try with today's date in YYYY-MM-DD format
    const [results2] = await connection.query(
      `SELECT b.id, b.customer_name, u.phone_number, s.name AS service_name, 
              b.time AS start_time, 
              DATE_FORMAT(DATE_ADD(STR_TO_DATE(CONCAT(b.date, ' ', b.time), '%Y-%m-%d %H:%i'), 
                      INTERVAL s.duration MINUTE), '%H:%i') AS end_time, b.status
       FROM bookings b
       JOIN services s ON b.service_id = s.id
       LEFT JOIN users u ON b.user_id = u.id
       WHERE b.staff_id = ? AND DATE(b.date) = ? AND b.status NOT IN ('Cancelled', 'Completed')
       ORDER BY b.time ASC
       LIMIT 3`,
      [19, currentDateISO]
    );
    console.log('Query results with ISO date:', results2);
    
    connection.release();
  } catch (err) {
    console.error('Error:', err);
  }
})();
