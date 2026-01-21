const mysql = require("mysql2/promise");

async function checkUserIds() {
  let connection;
  try {
    connection = await mysql.createConnection({
      host: "localhost",
      user: "root",
      password: "",
      database: "huuk"
    });

    console.log("Connected to database");

    // Check the format of user IDs in the users table
    const [users] = await connection.execute("SELECT id, role, fullname FROM users LIMIT 10");
    
    console.log("\n📋 Sample user IDs and their format:");
    console.table(users);
    
    // Check what the staffId and user_id look like in the booking that caused the error
    const [bookings] = await connection.execute(`
      SELECT b.id, b.user_id, b.staff_id, u1.fullname as customer_name, u2.fullname as staff_name 
      FROM bookings b 
      LEFT JOIN users u1 ON b.user_id = u1.id 
      LEFT JOIN users u2 ON b.staff_id = u2.id 
      ORDER BY b.id DESC 
      LIMIT 5
    `);
    
    console.log("\n📋 Recent bookings with user/staff IDs:");
    console.table(bookings);
    
    // Check what managers exist (they should receive notifications)
    const [managers] = await connection.execute("SELECT id, fullname FROM users WHERE role = 'manager' AND isApproved = 1");
    
    console.log("\n📋 Available managers:");
    console.table(managers);
    
  } catch (error) {
    console.error("Error checking user IDs:", error);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

checkUserIds();
