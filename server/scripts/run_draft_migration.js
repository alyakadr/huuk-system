const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

async function runMigration() {
  let connection;
  try {
    // Database configuration
    const dbConfig = {
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'huuk',
      port: process.env.DB_PORT || 3306
    };

    console.log('🔧 [MIGRATION] Connecting to database...');
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ [MIGRATION] Database connected successfully');

    // Read the migration SQL file
    const migrationPath = path.join(__dirname, '..', 'migrations', 'add_is_draft_to_bookings.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('📝 [MIGRATION] Running draft booking migration...');
    
    // Split the SQL file into individual statements
    const statements = migrationSQL.split(';').filter(stmt => stmt.trim());
    
    for (const statement of statements) {
      if (statement.trim()) {
        console.log(`🔧 [MIGRATION] Executing: ${statement.trim().substring(0, 50)}...`);
        await connection.execute(statement);
      }
    }

    console.log('✅ [MIGRATION] Draft booking migration completed successfully!');
    
  } catch (error) {
    console.error('❌ [MIGRATION] Error running migration:', error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('🔌 [MIGRATION] Database connection closed');
    }
  }
}

// Run the migration
runMigration(); 