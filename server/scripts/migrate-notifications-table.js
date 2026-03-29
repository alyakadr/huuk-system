require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mysql = require("mysql2/promise");

async function migrateNotificationsTable() {
  let connection;
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || "localhost",
      user: process.env.DB_USER || "root",
      password: process.env.DB_PASSWORD || "",
      database: process.env.DB_NAME || "huuk"
    });

    console.log("Connected to database");
    console.log("🔄 Starting notifications table migration...");

    // First, backup the current table
    console.log("📋 Creating backup of current notifications table...");
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS notifications_backup 
      AS SELECT * FROM notifications
    `);
    console.log("✅ Backup created: notifications_backup");

    // Check if there's existing data
    const [existingData] = await connection.execute("SELECT COUNT(*) as count FROM notifications");
    console.log(`📊 Found ${existingData[0].count} existing notifications`);

    // Drop the current table
    console.log("🗑️  Dropping current notifications table...");
    await connection.execute("DROP TABLE notifications");
    console.log("✅ Current table dropped");

    // Create the new table structure
    console.log("🛠️  Creating new notifications table structure...");
    await connection.execute(`
      CREATE TABLE notifications (
        id VARCHAR(36) PRIMARY KEY,
        user_id VARCHAR(36) NOT NULL,
        type VARCHAR(50) NOT NULL,
        title VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        is_read BOOLEAN DEFAULT FALSE,
        priority ENUM('low', 'medium', 'high', 'urgent') DEFAULT 'medium',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        expires_at TIMESTAMP NULL,
        metadata JSON,
        INDEX idx_user_id (user_id),
        INDEX idx_type (type),
        INDEX idx_is_read (is_read),
        INDEX idx_created_at (created_at)
      )
    `);
    console.log("✅ New notifications table created");

    // If there was existing data, try to migrate it
    if (existingData[0].count > 0) {
      console.log("🔄 Migrating existing data...");
      
      // Get the existing data
      const [oldData] = await connection.execute(`
        SELECT nb.*, b.user_id as booking_user_id, b.staff_id
        FROM notifications_backup nb
        LEFT JOIN bookings b ON nb.booking_id = b.id
      `);

      // Migrate each record
      for (const row of oldData) {
        const { v4: uuidv4 } = require('uuid');
        const notificationId = uuidv4();
        
        // Determine the user_id - use booking_user_id if available, otherwise use a default
        const userId = row.booking_user_id || row.staff_id || '1'; // fallback to user id 1
        
        await connection.execute(`
          INSERT INTO notifications (id, user_id, type, title, message, is_read, priority, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          notificationId,
          userId.toString(),
          row.type,
          `Notification: ${row.type}`, // Generate a title
          row.message,
          false, // Default to unread
          'medium', // Default priority
          row.created_at
        ]);
      }
      
      console.log(`✅ Migrated ${oldData.length} records`);
    }

    // Create the notification_settings table as well
    console.log("🛠️  Creating notification_settings table...");
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS notification_settings (
        id VARCHAR(36) PRIMARY KEY,
        user_id VARCHAR(36) NOT NULL,
        notification_type VARCHAR(50) NOT NULL,
        enabled BOOLEAN DEFAULT TRUE,
        email_enabled BOOLEAN DEFAULT FALSE,
        push_enabled BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY unique_user_type (user_id, notification_type)
      )
    `);
    console.log("✅ notification_settings table created");

    // Verify the new structure
    const [newColumns] = await connection.execute("DESCRIBE notifications");
    console.log("\n📋 New notifications table structure:");
    console.table(newColumns);

    console.log("\n🎉 Migration completed successfully!");
    console.log("\n⚠️  Note: Original data backed up in 'notifications_backup' table");
    console.log("💡 You can drop the backup table after confirming everything works correctly");

  } catch (error) {
    console.error("❌ Error during migration:", error);
    console.log("\n🔄 Rolling back...");
    
    try {
      // Try to restore from backup if it exists
      await connection.execute("DROP TABLE IF EXISTS notifications");
      await connection.execute("CREATE TABLE notifications AS SELECT * FROM notifications_backup");
      console.log("✅ Rollback completed - original table restored");
    } catch (rollbackError) {
      console.error("❌ Rollback failed:", rollbackError);
    }
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

migrateNotificationsTable();
