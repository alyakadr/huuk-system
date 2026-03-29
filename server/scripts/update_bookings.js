require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'huuk',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

async function updateBookingStaffIds() {
    try {
        console.log('Connecting to database...');
        
        // First, get all staff users
        const [staffUsers] = await pool.execute(`
            SELECT id, fullname, email 
            FROM users 
            WHERE role = 'staff' 
            ORDER BY id
        `);
        
        console.log('Available staff users:');
        staffUsers.forEach(staff => {
            console.log(`ID: ${staff.id}, Name: ${staff.fullname}, Email: ${staff.email}`);
        });
        
        if (staffUsers.length === 0) {
            console.log('No staff users found. Cannot update bookings.');
            return;
        }
        
        // Get current bookings with invalid staff_id
        const [bookings] = await pool.execute(`
            SELECT id, staff_id, customer_name, date, time 
            FROM bookings 
            WHERE staff_id NOT IN (SELECT id FROM users WHERE role = 'staff')
            ORDER BY id
        `);
        
        console.log(`\nFound ${bookings.length} bookings with invalid staff_id:`);
        bookings.forEach(booking => {
            console.log(`Booking ID: ${booking.id}, Current staff_id: ${booking.staff_id}, Customer: ${booking.customer_name}, Date: ${booking.date}, Time: ${booking.time}`);
        });
        
        if (bookings.length === 0) {
            console.log('No bookings need updating.');
            return;
        }
        
        // Update each booking with the first available staff ID
        // You can modify this logic to distribute bookings among staff or use specific assignment rules
        const defaultStaffId = staffUsers[0].id;
        
        console.log(`\nUpdating all bookings to use staff_id: ${defaultStaffId} (${staffUsers[0].fullname})`);
        
        const [updateResult] = await pool.execute(`
            UPDATE bookings 
            SET staff_id = ? 
            WHERE staff_id NOT IN (SELECT id FROM users WHERE role = 'staff')
        `, [defaultStaffId]);
        
        console.log(`Successfully updated ${updateResult.affectedRows} booking records.`);
        
        // Verify the update
        const [verifyBookings] = await pool.execute(`
            SELECT id, staff_id, customer_name, date, time 
            FROM bookings 
            ORDER BY id 
            LIMIT 10
        `);
        
        console.log('\nVerification - Sample updated bookings:');
        verifyBookings.forEach(booking => {
            console.log(`Booking ID: ${booking.id}, staff_id: ${booking.staff_id}, Customer: ${booking.customer_name}, Date: ${booking.date}, Time: ${booking.time}`);
        });
        
    } catch (error) {
        console.error('Error updating bookings:', error);
    } finally {
        await pool.end();
        console.log('\nDatabase connection closed.');
    }
}

updateBookingStaffIds();
