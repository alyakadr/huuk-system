const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config();

async function runMigration() {
  console.log('Starting migration to remove is_draft column from bookings table...');
  
  // Create database connection
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'huuk',
    port: process.env.DB_PORT || 3306,
  });

  try {
    // Read migration SQL file
    const migrationPath = path.join(__dirname, '..', 'migrations', 'remove_is_draft_from_bookings.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    // Split SQL commands by semicolon
    const commands = migrationSQL
      .split(';')
      .filter(cmd => cmd.trim() !== '')
      .map(cmd => cmd.trim() + ';');
    
    // Execute each command
    for (const command of commands) {
      console.log(`Executing: ${command}`);
      await connection.query(command);
    }
    
    console.log('✅ Migration completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    await connection.end();
  }
}

runMigration(); 