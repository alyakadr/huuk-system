const mysql = require('mysql2/promise');

async function checkDraftColumn() {
  let connection;
  try {
    const dbConfig = {
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'huuk',
      port: process.env.DB_PORT || 3306
    };

    console.log('🔍 [CHECK] Connecting to database...');
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ [CHECK] Database connected successfully');

    // Check if is_draft column exists
    const [columns] = await connection.execute(`
      SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = 'huuk' 
      AND TABLE_NAME = 'bookings' 
      AND COLUMN_NAME = 'is_draft'
    `);

    if (columns.length > 0) {
      console.log('✅ [CHECK] is_draft column exists:', columns[0]);
    } else {
      console.log('❌ [CHECK] is_draft column not found!');
    }

    // Check current bookings structure
    const [structure] = await connection.execute('DESCRIBE bookings');
    console.log('📋 [CHECK] Current bookings table structure:');
    structure.forEach(col => {
      console.log(`  - ${col.Field}: ${col.Type} ${col.Null === 'YES' ? 'NULL' : 'NOT NULL'} ${col.Default ? `DEFAULT ${col.Default}` : ''}`);
    });

  } catch (error) {
    console.error('❌ [CHECK] Error checking database:', error);
  } finally {
    if (connection) {
      await connection.end();
      console.log('🔌 [CHECK] Database connection closed');
    }
  }
}

checkDraftColumn(); 