const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkDraftColumnRemoved() {
  console.log('Checking if is_draft column has been removed from bookings table...');
  
  let connection;
  try {
    // Create database connection
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'huuk',
      port: process.env.DB_PORT || 3306,
    });

    // Check if is_draft column exists
    const [columns] = await connection.query(`
      SELECT COLUMN_NAME
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = ?
      AND TABLE_NAME = 'bookings'
      AND COLUMN_NAME = 'is_draft'
    `, [process.env.DB_NAME || 'huuk']);
    
    if (columns.length > 0) {
      console.log('❌ [CHECK] is_draft column still exists - migration was not successful');
    } else {
      console.log('✅ [CHECK] is_draft column has been successfully removed');
    }

    // Check if the index exists
    const [indexes] = await connection.query(`
      SHOW INDEX FROM bookings
      WHERE Key_name = 'idx_bookings_is_draft'
    `);
    
    if (indexes.length > 0) {
      console.log('❌ [CHECK] idx_bookings_is_draft index still exists - migration was not successful');
    } else {
      console.log('✅ [CHECK] idx_bookings_is_draft index has been successfully removed');
    }
    
  } catch (error) {
    console.error('❌ Error checking database:', error);
  } finally {
    if (connection) await connection.end();
  }
}

checkDraftColumnRemoved(); 