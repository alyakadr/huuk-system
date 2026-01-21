const mysql = require("mysql2/promise");

async function checkDatabaseSchema() {
  let connection;
  try {
    connection = await mysql.createConnection({
      host: "localhost",
      user: "root",
      password: "",
      database: "huuk"
    });

    console.log("Connected to database");

    // Check if notifications table exists
    const [tables] = await connection.execute("SHOW TABLES LIKE 'notifications'");
    
    if (tables.length === 0) {
      console.log("❌ notifications table does not exist");
      return;
    }

    console.log("✅ notifications table exists");
    
    // Get table structure
    const [columns] = await connection.execute("DESCRIBE notifications");
    
    console.log("\n📋 Current notifications table structure:");
    console.table(columns);
    
    // Check if user_id column exists
    const userIdColumn = columns.find(col => col.Field === 'user_id');
    if (userIdColumn) {
      console.log("\n✅ user_id column exists");
    } else {
      console.log("\n❌ user_id column is missing");
      
      // Check what columns do exist
      console.log("\n📝 Available columns:");
      columns.forEach(col => {
        console.log(`  - ${col.Field} (${col.Type})`);
      });
    }
    
  } catch (error) {
    console.error("Error checking database schema:", error);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

checkDatabaseSchema();
