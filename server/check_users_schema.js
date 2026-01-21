const pool = require('./config/db');

async function checkUsersSchema() {
  let connection;
  try {
    connection = await pool.getConnection();
    
    console.log('=== CHECKING USERS TABLE SCHEMA ===');
    
    const [schema] = await connection.query('DESCRIBE users');
    
    console.log('Users table columns:');
    schema.forEach(column => {
      console.log(`- ${column.Field}: ${column.Type} ${column.Null === 'YES' ? '(nullable)' : '(not null)'} ${column.Key ? `[${column.Key}]` : ''}`);
    });
    
  } catch (error) {
    console.error('Error checking users schema:', error);
  } finally {
    if (connection) connection.release();
  }
}

checkUsersSchema();
