const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkDatabaseSchema() {
    try {
        const config = {
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root', 
            password: process.env.DB_PASS || '',
            database: process.env.DB_NAME || 'huuk'
        };

        console.log('Connecting to database:', config.database);
        const connection = await mysql.createConnection(config);
        
        // Check bookings table schema
        console.log('\n=== BOOKINGS TABLE SCHEMA ===');
        const [rows] = await connection.execute('DESCRIBE bookings');
        console.table(rows);
        
        // Check if phone_number column exists
        const phoneNumberColumn = rows.find(row => row.Field === 'phone_number');
        if (phoneNumberColumn) {
            console.log('\n✅ phone_number column EXISTS in bookings table');
            console.log('Column details:', phoneNumberColumn);
        } else {
            console.log('\n❌ phone_number column does NOT exist in bookings table');
        }
        
        // Check migrations table
        console.log('\n=== CHECKING MIGRATIONS ===');
        const [tables] = await connection.execute('SHOW TABLES LIKE "migrations"');
        if (tables.length > 0) {
            console.log('Migrations table found. Recent migrations:');
            const [migrations] = await connection.execute('SELECT * FROM migrations ORDER BY id DESC LIMIT 5');
            console.table(migrations);
        } else {
            console.log('No migrations table found');
        }
        
        await connection.end();
        console.log('\n✅ Database check completed');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error('Full error:', error);
    }
}

checkDatabaseSchema();
