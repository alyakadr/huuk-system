const pool = require('./config/db');

async function debugBookings() {
    try {
        console.log('Checking table structures...');
        
        // Check bookings table structure
        const [bookingsSchema] = await pool.query('DESCRIBE bookings');
        console.log('\nBookings table structure:');
        console.log(JSON.stringify(bookingsSchema, null, 2));
        
        // Check users table structure
        const [usersSchema] = await pool.query('DESCRIBE users');
        console.log('\nUsers table structure:');
        console.log(JSON.stringify(usersSchema, null, 2));
        
        // Get sample bookings with all columns
        const [bookings] = await pool.query(`
            SELECT *
            FROM bookings
            ORDER BY id DESC
            LIMIT 5
        `);
        
        console.log('\nSample bookings:');
        console.log(JSON.stringify(bookings, null, 2));
        
        // Get staff users
        const [staff] = await pool.query(`
            SELECT id, email, fullname, role, isApproved
            FROM users
            WHERE role = 'staff'
            ORDER BY id
            LIMIT 10
        `);
        
        console.log('Staff users:');
        console.log(JSON.stringify(staff, null, 2));

        // Check if user ID 19 exists
        const [user19] = await pool.execute('SELECT * FROM users WHERE id = 19');
        console.log('\nUser with ID 19:');
        console.log(JSON.stringify(user19, null, 2));
        
    } catch (error) {
        console.error('Error querying database:', error);
    } finally {
        process.exit(0);
    }
}

debugBookings();
