const pool = require('./config/db');
nodenn
async function checkBookingsSchema() {
  let connection;
  try {
    connection = await pool.getConnection();
    
    console.log('=== CHECKING BOOKINGS TABLE SCHEMA ===');
    
    // Show the structure of the bookings table
    const [schema] = await connection.query('DESCRIBE bookings');
    
    console.log('Bookings table columns:');
    schema.forEach(column => {
      console.log(`- ${column.Field}: ${column.Type} ${column.Null === 'YES' ? '(nullable)' : '(not null)'} ${column.Key ? `[${column.Key}]` : ''} ${column.Default !== null ? `default: ${column.Default}` : ''}`);
    });
    
    // Also check if there are any sample records to understand the structure better
    console.log('\n=== SAMPLE RECORDS ===');
    const [samples] = await connection.query('SELECT * FROM bookings LIMIT 3');
    console.log('Sample bookings:', JSON.stringify(samples, null, 2));
    
  } catch (error) {
    console.error('❌ Error checking schema:', error);
  } finally {
    if (connection) connection.release();
  }
}

checkBookingsSchema();
