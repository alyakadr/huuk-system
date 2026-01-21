const mysql = require('mysql2/promise');
require('dotenv').config();

async function runMigration() {
  let connection;
  
  try {
    // Create connection
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'huuk'
    });

    console.log('Connected to database...');

    // Check if column already exists
    const [columns] = await connection.execute(
      "SHOW COLUMNS FROM bookings LIKE 'phone_number'"
    );

    if (columns.length > 0) {
      console.log('✅ phone_number column already exists in bookings table');
      return;
    }

    // Add phone_number column
    console.log('Adding phone_number column to bookings table...');
    await connection.execute(
      'ALTER TABLE bookings ADD COLUMN phone_number VARCHAR(20)'
    );
    
    console.log('✅ Migration completed successfully!');
    
    // Verify the column was added
    const [newColumns] = await connection.execute(
      "SHOW COLUMNS FROM bookings"
    );
    
    console.log('📋 Current bookings table columns:');
    newColumns.forEach(col => {
      console.log(`  - ${col.Field} (${col.Type})`);
    });

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('Database connection closed.');
    }
  }
}

runMigration();
