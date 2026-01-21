const fs = require('fs');
const path = require('path');
const pool = require('./config/db');

async function runMigration() {
  try {
    // Read the migration file
    const migrationPath = path.join(__dirname, 'migrations', 'create_slot_reservations.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    // Split SQL statements (remove comments and empty lines)
    const statements = migrationSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
    
    console.log('Starting migration...');
    
    // Execute each statement
    for (const statement of statements) {
      if (statement.trim()) {
        console.log(`Executing: ${statement.substring(0, 50)}...`);
        await pool.execute(statement);
      }
    }
    
    console.log('Migration completed successfully!');
    console.log('slot_reservations table has been created.');
    
    // Verify the table was created
    const [rows] = await pool.execute('DESCRIBE slot_reservations');
    console.log('\nTable structure:');
    console.table(rows);
    
  } catch (error) {
    console.error('Migration failed:', error.message);
    
    // If it's a foreign key error, provide helpful info
    if (error.message.includes('foreign key constraint')) {
      console.log('\nForeign key constraint error detected.');
      console.log('Checking if referenced tables exist...');
      
      const tables = ['users', 'outlets', 'services'];
      for (const table of tables) {
        try {
          const [result] = await pool.execute(`SHOW TABLES LIKE '${table}'`);
          console.log(`Table '${table}': ${result.length > 0 ? 'EXISTS' : 'MISSING'}`);
        } catch (err) {
          console.log(`Table '${table}': Error checking - ${err.message}`);
        }
      }
    }
  } finally {
    await pool.end();
  }
}

// Run the migration
runMigration();
