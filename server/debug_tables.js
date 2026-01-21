const mysql = require('mysql2/promise');

async function debugTables() {
    const connection = await mysql.createConnection({
        host: 'localhost',
        user: 'root',
        password: '',
        database: 'huuk'
    });

    try {
        console.log('=== DATABASE TABLES ===');
        const [tables] = await connection.execute('SHOW TABLES');
        console.log('Available tables:');
        tables.forEach(table => {
            console.log(`- ${Object.values(table)[0]}`);
        });

        console.log('\n=== USERS TABLE STRUCTURE ===');
        const [userColumns] = await connection.execute('DESCRIBE users');
        console.log('Users table columns:');
        userColumns.forEach(col => {
            console.log(`- ${col.Field} (${col.Type})`);
        });

        console.log('\n=== BOOKINGS TABLE STRUCTURE ===');
        const [bookingColumns] = await connection.execute('DESCRIBE bookings');
        console.log('Bookings table columns:');
        bookingColumns.forEach(col => {
            console.log(`- ${col.Field} (${col.Type})`);
        });

        console.log('\n=== BOOKING 108 DETAILS ===');
        const [booking] = await connection.execute('SELECT * FROM bookings WHERE id = ?', [108]);
        if (booking.length > 0) {
            console.log('Booking 108 details:');
            console.log(booking[0]);
        } else {
            console.log('Booking 108 not found');
        }

        console.log('\n=== STAFF USER DETAILS ===');
        if (booking.length > 0) {
            const staffId = booking[0].staff_id;
            const [staff] = await connection.execute('SELECT * FROM users WHERE id = ?', [staffId]);
            if (staff.length > 0) {
                console.log(`Staff user (ID: ${staffId}) details:`);
                console.log(staff[0]);
            } else {
                console.log(`Staff user with ID ${staffId} not found`);
            }
        }

        console.log('\n=== CHECKING AUTHORIZATION LOGIC ===');
        if (booking.length > 0) {
            const staffId = booking[0].staff_id;
            console.log(`Booking staff_id: ${staffId}`);
            
            // This is what the controller is trying to do
            const [authCheck] = await connection.execute(
                'SELECT * FROM bookings WHERE id = ? AND staff_id = ?',
                [108, staffId]
            );
            
            console.log(`Authorization check result: ${authCheck.length > 0 ? 'AUTHORIZED' : 'NOT AUTHORIZED'}`);
            
            if (authCheck.length > 0) {
                console.log('The booking belongs to the staff member - authorization should pass');
            } else {
                console.log('The booking does NOT belong to the staff member - authorization should fail');
            }
        }

    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        await connection.end();
    }
}

debugTables();
